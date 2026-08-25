import asyncio
import email as email_lib
import imaplib
import os
import re
import time
import httpx
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.constants import ParseMode
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

load_dotenv()

import yfinance as yf
import pandas as pd

# Cache de resultados de earnings por ticker (TTL de 24h)
_earnings_cache: dict = {}
_EARNINGS_CACHE_TTL = 86400  # segundos

AV_BASE = "https://www.alphavantage.co/query"

from services.snowflake_service import get_snowflake_analysis, get_peers, get_fallback_peers

STEP_TIMEOUT = 30

SECTOR_NAMES = [
    "Technology", "Healthcare", "Financial Services",
    "Consumer Cyclical", "Communication Services",
    "Energy", "Industrials", "Consumer Defensive",
    "Utilities", "Real Estate", "Basic Materials",
]

SECTOR_NORMALIZE = {
    "technology": "Technology",
    "tech": "Technology",
    "information technology": "Technology",
    "healthcare": "Healthcare",
    "health care": "Healthcare",
    "financial": "Financial Services",
    "financials": "Financial Services",
    "financial services": "Financial Services",
    "consumer cyclical": "Consumer Cyclical",
    "consumer discretionary": "Consumer Cyclical",
    "communication": "Communication Services",
    "communication services": "Communication Services",
    "energy": "Energy",
    "industrials": "Industrials",
    "industrial": "Industrials",
    "consumer defensive": "Consumer Defensive",
    "consumer staples": "Consumer Defensive",
    "utilities": "Utilities",
    "real estate": "Real Estate",
    "basic materials": "Basic Materials",
    "materials": "Basic Materials",
}


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _f(v) -> Optional[float]:
    try:
        return round(float(v), 2) if v is not None else None
    except Exception:
        return None


def _fmt_large(v) -> Optional[str]:
    try:
        n = float(v)
        if n >= 1_000_000_000_000: return f"{n/1e12:.2f}T"
        if n >= 1_000_000_000:     return f"{n/1e9:.2f}B"
        if n >= 1_000_000:         return f"{n/1e6:.2f}M"
        return f"{n:,.0f}"
    except Exception:
        return None


def _fetch_price_data(info: dict) -> dict:
    price = info.get("currentPrice") or info.get("regularMarketPrice")
    change_amount = _f(info.get("regularMarketChange"))
    prev_close_val = _f(info.get("previousClose"))
    change_pct_val = (
        round(change_amount / prev_close_val * 100, 2)
        if change_amount is not None and prev_close_val
        else None
    )
    return {
        "current":     _f(price),
        "change":      change_amount,
        "change_pct":  change_pct_val,
        "prev_close":  _f(info.get("open")),
        "day_high":    _f(info.get("dayHigh")),
        "day_low":     _f(info.get("dayLow")),
        "week52_high": _f(info.get("fiftyTwoWeekHigh")),
        "week52_low":  _f(info.get("fiftyTwoWeekLow")),
        "market_cap":  _fmt_large(info.get("marketCap")),
        "avg_volume":  _fmt_large(info.get("averageVolume")),
        "beta":        _f(info.get("beta")),
        "currency":    info.get("currency", "USD"),
    }


def _fetch_analysts(price: Optional[float], info: dict, stock=None) -> dict:
    result = {
        "price_target": {
            "current": price,
            "mean":    _f(info.get("targetMeanPrice")),
        },
        "recommendation":     info.get("recommendationKey", "N/A"),
        "number_of_analysts": info.get("numberOfAnalystOpinions"),
        "rec_breakdown":      None,
    }

    if stock is not None:
        try:
            rec_sum = stock.recommendations_summary
            if rec_sum is not None and not rec_sum.empty:
                row = rec_sum.iloc[0]
                strong_buy  = int(row.get("strongBuy",  0) or 0)
                buy         = int(row.get("buy",        0) or 0)
                hold        = int(row.get("hold",       0) or 0)
                sell        = int(row.get("sell",       0) or 0)
                strong_sell = int(row.get("strongSell", 0) or 0)
                total = strong_buy + buy + hold + sell + strong_sell
                if total > 0:
                    rec_key = result["recommendation"]
                    if rec_key in ("strong_buy", "buy"):
                        count = strong_buy + buy
                    elif rec_key == "hold":
                        count = hold
                    elif rec_key in ("sell", "strong_sell"):
                        count = sell + strong_sell
                    else:
                        count = strong_buy + buy
                    result["rec_breakdown"] = {
                        "count": count,
                        "total": total,
                    }
        except Exception:
            pass

    return result


def _get_close_df(data: pd.DataFrame) -> pd.DataFrame:
    if data.empty:
        return pd.DataFrame()
    if isinstance(data.columns, pd.MultiIndex):
        lvl0 = data.columns.get_level_values(0)
        lvl1 = data.columns.get_level_values(1)
        if "Close" in lvl0:
            return data["Close"]
        if "Close" in lvl1:
            return data.xs("Close", level=1, axis=1)
    if "Close" in data.columns:
        return data[["Close"]]
    return pd.DataFrame()


# ---------------------------------------------------------------------------
# Telegram text formatter
# ---------------------------------------------------------------------------

def _score_bar(score: int, max_score: int, width: int = 10) -> str:
    filled = round(score / max_score * width) if max_score > 0 else 0
    return "█" * filled + "░" * (width - filled)


def _to_float_safe(value) -> Optional[float]:
    if value in (None, "None", ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _av_get(function: str, symbol: str, api_key: str) -> dict:
    params: dict = {"function": function, "apikey": api_key}
    if symbol:
        params["symbol"] = symbol
    with httpx.Client(timeout=30) as client:
        resp = client.get(AV_BASE, params=params)
    resp.raise_for_status()
    data = resp.json()
    if "Error Message" in data:
        raise RuntimeError(data["Error Message"])
    if "Note" in data or "Information" in data:
        raise RuntimeError(f"Rate limit AV: {data.get('Note') or data.get('Information')}")
    return data


def _fetch_earnings_history(stock: yf.Ticker) -> list:
    ticker = stock.ticker.upper()
    api_key = os.getenv("ALPHA_VANTAGE_API_KEY")

    cached = _earnings_cache.get(ticker)
    if cached and (time.time() - cached[0]) < _EARNINGS_CACHE_TTL:
        return cached[1]

    result = _fetch_via_alpha_vantage(stock, ticker, api_key) if api_key else []
    if not result:
        result = _fetch_via_yfinance(stock)

    _earnings_cache[ticker] = (time.time(), result)
    return result


def _fetch_via_alpha_vantage(stock: yf.Ticker, ticker: str, api_key: str) -> list:
    try:
        av_earnings = _av_get("EARNINGS", ticker, api_key)
        time.sleep(1.1)
        av_estimates = _av_get("EARNINGS_ESTIMATES", ticker, api_key)

        rev_actuals: dict = {}
        try:
            qi = stock.quarterly_income_stmt
            for row_name in ["Total Revenue", "TotalRevenue", "Revenue"]:
                if row_name in qi.index:
                    for col in qi.columns:
                        val = qi.loc[row_name, col]
                        if pd.notna(val):
                            rev_actuals[pd.Timestamp(col).strftime("%Y-%m-%d")] = float(val)
                    break
        except Exception:
            pass

        rev_estimates: dict = {}
        for est in av_estimates.get("estimates", []):
            if est.get("horizon") != "fiscal quarter":
                continue
            val = _to_float_safe(est.get("revenue_estimate_average"))
            if val is not None:
                rev_estimates[est["date"]] = val

        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        results = []
        for entry in av_earnings.get("quarterlyEarnings", []):
            reported_date = entry.get("reportedDate", "")
            if not reported_date or reported_date > today:
                continue

            lpa_act = _to_float_safe(entry.get("reportedEPS"))
            if lpa_act is None:
                continue

            lpa_est  = _to_float_safe(entry.get("estimatedEPS"))
            lpa_surp = _to_float_safe(entry.get("surprisePercentage"))
            lpa_beat = (lpa_act > lpa_est if lpa_act != lpa_est else None) if lpa_est is not None else None

            fiscal_date = entry.get("fiscalDateEnding", "")
            rev_act = rev_actuals.get(fiscal_date)
            rev_est = rev_estimates.get(fiscal_date)
            rev_surp = None
            rev_beat = None
            if rev_act is not None and rev_est:
                rev_surp = round((rev_act - rev_est) / abs(rev_est) * 100, 2)
                rev_beat = rev_act > rev_est if rev_act != rev_est else None

            try:
                date_label = pd.Timestamp(fiscal_date).strftime("%b %Y")
            except Exception:
                date_label = fiscal_date

            results.append({
                "date": date_label,
                "lpa_estimate": round(lpa_est, 2) if lpa_est is not None else None,
                "lpa_actual": round(lpa_act, 2),
                "lpa_surprise_pct": round(lpa_surp, 2) if lpa_surp is not None else None,
                "lpa_beat": lpa_beat,
                "rev_estimate": rev_est,
                "rev_actual": rev_act,
                "rev_surprise_pct": rev_surp,
                "rev_beat": rev_beat,
            })

            if len(results) == 4:
                break

        return results

    except Exception as e:
        print(f"Erro Alpha Vantage earnings ({ticker}): {e}")
        return []


def _fetch_via_yfinance(stock: yf.Ticker) -> list:
    try:
        df = stock.earnings_dates
        if df is None or df.empty or "Reported EPS" not in df.columns:
            return []

        past = df[df["Reported EPS"].notna()].sort_index(ascending=False).head(4)
        if past.empty:
            return []

        has_rev = "Reported Revenue" in df.columns and "Revenue Estimate" in df.columns
        results = []
        for dt, row in past.iterrows():
            date_label = pd.Timestamp(dt).strftime("%b %Y")

            lpa_est  = row.get("EPS Estimate")
            lpa_act  = row.get("Reported EPS")
            lpa_surp = row.get("Surprise(%)")

            lpa_est_f  = None if (lpa_est is None or pd.isna(lpa_est))  else round(float(lpa_est), 2)
            lpa_act_f  = None if (lpa_act is None or pd.isna(lpa_act))  else round(float(lpa_act), 2)
            lpa_surp_f = None if (lpa_surp is None or pd.isna(lpa_surp)) else round(float(lpa_surp), 2)
            lpa_beat   = (lpa_act_f > lpa_est_f if lpa_act_f != lpa_est_f else None) if lpa_act_f is not None and lpa_est_f is not None else None

            entry = {
                "date": date_label,
                "lpa_estimate": lpa_est_f, "lpa_actual": lpa_act_f,
                "lpa_surprise_pct": lpa_surp_f, "lpa_beat": lpa_beat,
                "rev_estimate": None, "rev_actual": None,
                "rev_surprise_pct": None, "rev_beat": None,
            }

            if has_rev:
                rev_est  = row.get("Revenue Estimate")
                rev_act  = row.get("Reported Revenue")
                rev_surp = row.get("Revenue Surprise(%)")
                rev_est_f  = None if (rev_est is None or pd.isna(rev_est))  else float(rev_est)
                rev_act_f  = None if (rev_act is None or pd.isna(rev_act))  else float(rev_act)
                rev_surp_f = None if (rev_surp is None or pd.isna(rev_surp)) else round(float(rev_surp), 2)
                rev_beat   = (rev_act_f > rev_est_f if rev_act_f != rev_est_f else None) if rev_act_f is not None and rev_est_f is not None else None
                entry.update({"rev_estimate": rev_est_f, "rev_actual": rev_act_f, "rev_surprise_pct": rev_surp_f, "rev_beat": rev_beat})

            results.append(entry)

        return results

    except Exception as e:
        print(f"Erro yfinance earnings history: {e}")
        return []


def _fmt_rev(value) -> str:
    if value is None:
        return "—"
    abs_v = abs(value)
    if abs_v >= 1e12:
        return f"${value/1e12:.1f}T"
    if abs_v >= 1e9:
        return f"${value/1e9:.1f}B"
    if abs_v >= 1e6:
        return f"${value/1e6:.1f}M"
    return f"${value:.0f}"


def _format_earnings_section(earnings: list) -> str:
    if not earnings:
        return ""

    has_rev = any(e.get("rev_actual") is not None for e in earnings)
    parts = ["", "<b>📊 RESULTADOS TRIMESTRAIS</b>"]

    for e in earnings:
        lpa_act = e.get("lpa_actual")
        if lpa_act is None:
            continue

        date     = e.get("date", "")
        lpa_est  = e.get("lpa_estimate")
        lpa_surp = e.get("lpa_surprise_pct")
        lpa_beat = e.get("lpa_beat")
        lpa_icon = "✅" if lpa_beat is True else ("❌" if lpa_beat is False else "➖")

        lpa_proj_s = f"  proj ${lpa_est:.2f}" if lpa_est is not None else ""
        lpa_surp_s = ""
        if lpa_surp is not None:
            sign = "+" if lpa_surp >= 0 else ""
            lpa_surp_s = f"  {sign}{lpa_surp:.1f}%"

        block = f"LPA {lpa_icon}  ${lpa_act:.2f}{lpa_proj_s}{lpa_surp_s}"

        if has_rev:
            rev_act  = e.get("rev_actual")
            rev_est  = e.get("rev_estimate")
            rev_surp = e.get("rev_surprise_pct")
            rev_beat = e.get("rev_beat")
            rev_icon = "✅" if rev_beat is True else ("❌" if rev_beat is False else "➖")

            rev_proj_s = f"  proj {_fmt_rev(rev_est)}" if rev_est is not None else ""
            rev_surp_s = ""
            if rev_surp is not None:
                sign = "+" if rev_surp >= 0 else ""
                rev_surp_s = f"  {sign}{rev_surp:.1f}%"

            if rev_act is not None:
                block += f"\nRec {rev_icon}  {_fmt_rev(rev_act)}{rev_proj_s}{rev_surp_s}"

        parts.append("")
        parts.append(f"<b>{date}</b>")
        parts.append(f"<code>{block}</code>")

    return "\n".join(parts)


def format_telegram_analysis(
    ticker: str,
    company_name: str,
    sector: str,
    price_data: dict,
    snowflake: dict,
    analysts: dict,
    earnings: list = None,
) -> str:
    price = price_data.get("current")
    change = price_data.get("change")
    change_pct = price_data.get("change_pct")
    market_cap = price_data.get("market_cap")

    change_icon = "📈" if (change or 0) >= 0 else "📉"
    change_str = ""
    if change is not None and change_pct is not None:
        sign = "+" if change >= 0 else ""
        change_str = f"  {change_icon} {sign}{change:.2f} ({sign}{change_pct:.2f}%)"

    lines = [
        f"<b>📊 {ticker} — {company_name}</b>",
        f"💵 <b>${price:.2f}</b>{change_str}" if price else "💵 Preço indisponível",
    ]
    if sector and sector not in ("N/A", ""):
        cap_str = f" | Mkt Cap: {market_cap}" if market_cap else ""
        lines.append(f"Setor: {sector}{cap_str}")

    # Snowflake section
    if snowflake:
        lines += ["", "<b>❄️ ANÁLISE SNOWFLAKE</b>"]
        section_labels = {
            "value":    "Valuation",
            "future":   "Crescimento",
            "past":     "Desempenho",
            "health":   "Saúde Fin.",
            "dividend": "Dividendos",
        }
        total_score = total_max = 0
        for key, label in section_labels.items():
            group = snowflake.get(key)
            if not group:
                continue
            score = group.get("score", 0)
            max_s = group.get("max", 6)
            total_score += score
            total_max += max_s
            bar = _score_bar(score, max_s)
            icon = "✅" if score >= max_s * 0.6 else ("⚠️" if score >= max_s * 0.3 else "❌")
            lines.append(f"<code>{label:<13} {icon} {score}/{max_s}  {bar}</code>")
        if total_max > 0:
            pct = round(total_score / total_max * 100)
            lines.append(f"\n<b>Total: {total_score}/{total_max} ({pct}%)</b>")

    # Price Target section
    pt = analysts.get("price_target", {})
    mean = pt.get("mean")
    recommendation = analysts.get("recommendation", "")
    n_analysts = analysts.get("number_of_analysts")
    rec_breakdown = analysts.get("rec_breakdown")

    if mean:
        lines += ["", "<b>🎯 PRICE TARGET (Consenso)</b>"]
        upside_str = ""
        if price:
            upside_pct = (mean - price) / price * 100
            sign = "+" if upside_pct >= 0 else ""
            upside_str = f"  ({sign}{upside_pct:.1f}% upside)"
        lines.append(f"Médio:  ${mean:.2f}{upside_str}")
        if recommendation and recommendation not in ("N/A", "none", ""):
            rec_map = {
                "strong_buy":  "Strong Buy 🟢",
                "buy":         "Buy 🟢",
                "hold":        "Hold 🟡",
                "sell":        "Sell 🔴",
                "strong_sell": "Strong Sell 🔴",
            }
            rec_label = rec_map.get(recommendation, recommendation.replace("_", " ").title())
            if rec_breakdown:
                n_str = f" ({rec_breakdown['count']}/{rec_breakdown['total']} analistas)"
            elif n_analysts:
                n_str = f" ({n_analysts} analistas)"
            else:
                n_str = ""
            lines.append(f"📌 Recomendação: {rec_label}{n_str}")

    # Earnings history section
    if earnings:
        section = _format_earnings_section(earnings)
        if section:
            lines.append(section)

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Market data helpers
# ---------------------------------------------------------------------------

def _yf_screen_movers(mover_type: str, limit: int) -> list:
    from yfinance.screener.screener import screen
    screener_id = "day_gainers" if mover_type == "gainers" else "day_losers"
    data   = screen(screener_id, count=max(limit * 4, 25))
    quotes = data.get("quotes", [])

    results = []
    for q in quotes:
        symbol = q.get("symbol", "")
        price  = _to_float_safe(q.get("regularMarketPrice"))

        if symbol.endswith(("W", "U")) or "." in symbol:
            continue
        if price is None or price < 5.0:
            continue

        change     = _to_float_safe(q.get("regularMarketChange"))
        change_pct = _to_float_safe(q.get("regularMarketChangePercent"))
        results.append({
            "ticker":     symbol,
            "price":      round(price, 2),
            "change":     round(change, 2) if change is not None else None,
            "change_pct": round(change_pct, 2) if change_pct is not None else None,
        })

        if len(results) == limit:
            break

    return results


# ---------------------------------------------------------------------------
# Gmail / GuruFocus helpers
# ---------------------------------------------------------------------------

def _fix_encoding(text: str) -> str:
    try:
        return text.encode("latin-1").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return text


def _html_to_text(html: str) -> str:
    from html.parser import HTMLParser

    class _Extractor(HTMLParser):
        def __init__(self):
            super().__init__()
            self.parts: list[str] = []
            self._skip = False

        def handle_starttag(self, tag, attrs):
            if tag in ("script", "style"):
                self._skip = True
            if tag in ("p", "br", "li", "div", "tr"):
                self.parts.append("\n")

        def handle_endtag(self, tag):
            if tag in ("script", "style"):
                self._skip = False

        def handle_data(self, data):
            if not self._skip:
                self.parts.append(data)

    extractor = _Extractor()
    extractor.feed(html)
    return "".join(extractor.parts)


def _fetch_gurufocus_body() -> tuple[str, str]:
    gmail_user = os.getenv("GMAIL_USER", "")
    gmail_pass = os.getenv("GMAIL_APP_PASSWORD", "").replace(" ", "")
    if not gmail_user or not gmail_pass:
        raise RuntimeError("GMAIL_USER ou GMAIL_APP_PASSWORD não configurados.")

    with imaplib.IMAP4_SSL("imap.gmail.com") as mail:
        mail.login(gmail_user, gmail_pass)
        mail.select("inbox")

        _, d1 = mail.search(None, 'FROM "gurufocus@gurufocus.com" SUBJECT "First Look"')
        _, d2 = mail.search(None, 'FROM "gurufocus@gurufocus.com" SUBJECT "Market Today"')
        ids1 = d1[0].split() if d1[0] else []
        ids2 = d2[0].split() if d2[0] else []
        ids = sorted(ids1 + ids2, key=int)

        if not ids:
            raise RuntimeError("Nenhum email 'First Look' ou 'Market Today' do GuruFocus encontrado.")

        _, msg_data = mail.fetch(ids[-1], "(RFC822)")
        msg = email_lib.message_from_bytes(msg_data[0][1])

        subject_parts = email_lib.header.decode_header(msg["Subject"])[0]
        subject_str = (
            subject_parts[0].decode(subject_parts[1] or "utf-8")
            if isinstance(subject_parts[0], bytes)
            else subject_parts[0]
        )
        subject_str = _fix_encoding(subject_str)

        plain = html = ""
        if msg.is_multipart():
            for part in msg.walk():
                ct = part.get_content_type()
                charset = part.get_content_charset() or "utf-8"
                if ct == "text/plain" and not plain:
                    plain = part.get_payload(decode=True).decode(charset, errors="replace")
                elif ct == "text/html" and not html:
                    html = part.get_payload(decode=True).decode(charset, errors="replace")
        else:
            charset = msg.get_content_charset() or "utf-8"
            raw = msg.get_payload(decode=True).decode(charset, errors="replace")
            if msg.get_content_type() == "text/html":
                html = raw
            else:
                plain = raw

        body = plain if plain.strip() else _html_to_text(html)
        return subject_str, body


def _parse_stock_news(body: str) -> list[str]:
    m = re.search(r"Stock News\s*\n", body)
    if not m:
        return []

    after = body[m.end():]
    items = []

    if re.search(r"^\*\s+\w", after, re.MULTILINE):
        for line in after.splitlines():
            line = line.strip()
            if not line:
                continue
            if not line.startswith("*") and re.match(r"^[A-Z][A-Za-z\s]{2,35}$", line):
                break
            if not line.startswith("*"):
                continue
            line = line[1:].strip()
            line = re.sub(r"\s*Source:\s*\[[^\]]+\]\([^)]+\)\.?\s*$", "", line)
            line = re.sub(r"\[([A-Z]{1,5})\]\([^)]+\)", r"\1", line)
            line = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", line)
            line = _fix_encoding(line).strip().rstrip(".")
            if line:
                items.append(line)
        return items

    for line in after.splitlines():
        line = line.strip()
        if not line:
            continue
        if len(line) < 45 and ": " not in line and re.match(r"^[A-Z][A-Za-z\s]+$", line):
            break
        if ": " not in line:
            continue
        line = re.sub(r"\s*Source:\s*[^.]+\.\s*$", "", line)
        line = _fix_encoding(line).strip().rstrip(".")
        if len(line) > 20:
            items.append(line)

    return items


# ---------------------------------------------------------------------------
# Telegram bot handlers
# ---------------------------------------------------------------------------

_tg_app: Optional[Application] = None
_MAIN_MENU_TEXT = "🤖 <b>Bem-vindo ao Radar de Ativos</b>\n\nEscolha uma opção:"
_MAX_MSG = 4096

_LOG_DIR   = "/app/logs"
_LOG_FILE  = "/app/logs/interactions.log"
_USERS_FILE = "/app/logs/users.txt"


def _log(chat_id: int, action: str):
    try:
        os.makedirs(_LOG_DIR, exist_ok=True)
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")
        known = set()
        if os.path.exists(_USERS_FILE):
            with open(_USERS_FILE) as f:
                known = {l.strip() for l in f if l.strip()}
        is_new = str(chat_id) not in known
        if is_new:
            with open(_USERS_FILE, "a") as f:
                f.write(f"{chat_id}\n")
        tag = "NOVO" if is_new else "----"
        with open(_LOG_FILE, "a") as f:
            f.write(f"{now} | {tag} | {chat_id} | {action}\n")
    except Exception:
        pass


def _stats_text() -> str:
    try:
        os.makedirs(_LOG_DIR, exist_ok=True)
        users = 0
        if os.path.exists(_USERS_FILE):
            with open(_USERS_FILE) as f:
                users = sum(1 for l in f if l.strip())
        interactions = 0
        recent = []
        if os.path.exists(_LOG_FILE):
            with open(_LOG_FILE) as f:
                lines = [l.strip() for l in f if l.strip()]
            interactions = len(lines)
            recent = lines[-10:]
        lines_out = [
            "📊 <b>Estatísticas do Bot</b>",
            "",
            f"👥 Usuários únicos: <b>{users}</b>",
            f"🔢 Total de interações: <b>{interactions}</b>",
            "",
            "<b>Últimas 10 interações:</b>",
        ] + [f"<code>{l}</code>" for l in recent]
        return "\n".join(lines_out)
    except Exception as e:
        return f"Erro ao ler estatísticas: {e}"


def _main_menu_markup() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("📈 Analisar Ação", callback_data="ask_ticker")],
        [
            InlineKeyboardButton("🔥 Maiores Altas", callback_data="get_gainers"),
            InlineKeyboardButton("📉 Maiores Baixas", callback_data="get_losers"),
        ],
        [InlineKeyboardButton("🏢 Buscar por Setor", callback_data="get_sectors")],
        [InlineKeyboardButton("📰 Resumo do Dia", callback_data="get_summary")],
    ])


def _back_markup() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("🔙 Menu Principal", callback_data="send_menu")],
    ])


def _analysis_markup() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("🔍 Nova Análise", callback_data="ask_ticker")],
        [InlineKeyboardButton("🔙 Menu Principal", callback_data="send_menu")],
    ])


def _truncate(text: str, max_len: int = _MAX_MSG) -> str:
    if len(text) <= max_len:
        return text
    return text[:max_len - 40] + "\n\n<i>[Mensagem truncada]</i>"


async def _show_main_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    markup = _main_menu_markup()
    if update.callback_query:
        await update.callback_query.answer()
        await update.callback_query.edit_message_text(
            _MAIN_MENU_TEXT, reply_markup=markup, parse_mode=ParseMode.HTML
        )
    else:
        await update.message.reply_text(
            _MAIN_MENU_TEXT, reply_markup=markup, parse_mode=ParseMode.HTML
        )


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    _log(update.effective_chat.id, "/start")
    await _show_main_menu(update, context)


async def cmd_stats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    owner_id = os.getenv("OWNER_CHAT_ID", "")
    if owner_id and str(update.effective_chat.id) != owner_id:
        return
    await update.message.reply_text(_stats_text(), parse_mode=ParseMode.HTML)


async def cb_send_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    _log(update.effective_chat.id, "menu_principal")
    await _show_main_menu(update, context)


async def cb_ask_ticker(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.callback_query.answer()
    context.user_data["awaiting_ticker"] = True
    await update.callback_query.edit_message_text(
        "Digite o ticker da ação que deseja analisar:\n<i>Exemplos: AAPL, MSFT, NVDA, KLAC</i>",
        reply_markup=_back_markup(),
        parse_mode=ParseMode.HTML,
    )


async def _build_movers_text(mover_type: str) -> str:
    results = await asyncio.to_thread(_yf_screen_movers, mover_type, 5)
    if not results:
        return "📊 Sem dados disponíveis no momento."
    header = "🔥 <b>MAIORES ALTAS DO DIA</b>" if mover_type == "gainers" else "📉 <b>MAIORES BAIXAS DO DIA</b>"
    lines = [header, ""]
    for r in results:
        pct = r.get("change_pct") or 0
        sign = "+" if pct >= 0 else ""
        lines.append(f"<b>{r['ticker']}</b>  ${r['price']:.2f}  {sign}{pct:.2f}%")
    return "\n".join(lines)


async def cb_get_sectors(update: Update, context: ContextTypes.DEFAULT_TYPE):
    _log(update.effective_chat.id, "buscar_setor")
    await update.callback_query.answer()
    keyboard = []
    row = []
    for sector in SECTOR_NAMES:
        row.append(InlineKeyboardButton(sector, callback_data=f"sector:{sector}"))
        if len(row) == 2:
            keyboard.append(row)
            row = []
    if row:
        keyboard.append(row)
    keyboard.append([InlineKeyboardButton("🔙 Menu Principal", callback_data="send_menu")])
    await update.callback_query.edit_message_text(
        "🏢 <b>Selecione um setor:</b>",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode=ParseMode.HTML,
    )


async def cb_get_sector_stocks(update: Update, context: ContextTypes.DEFAULT_TYPE):
    sector = update.callback_query.data.split(":", 1)[1]
    await update.callback_query.answer(f"Buscando {sector}...")
    try:
        normalized = SECTOR_NORMALIZE.get(sector.lower(), sector)
        tickers = get_fallback_peers(normalized)
        if not tickers:
            text = f"❌ Setor '{sector}' não encontrado."
        else:
            async def _fetch(sym: str):
                def _get():
                    fi = yf.Ticker(sym).fast_info
                    return (
                        getattr(fi, "market_cap", None),
                        getattr(fi, "last_price", None),
                        getattr(fi, "previous_close", None),
                    )
                try:
                    cap, price, prev = await asyncio.to_thread(_get)
                    chg = round((price - prev) / prev * 100, 2) if price and prev and prev > 0 else None
                    return {"ticker": sym, "price": price, "change_pct": chg, "market_cap": float(cap) if cap else 0}
                except Exception:
                    return None

            raw = await asyncio.gather(*[_fetch(sym) for sym in tickers[:12]])
            valid = [r for r in raw if r and r.get("market_cap", 0) > 0]
            top = sorted(valid, key=lambda x: x["market_cap"], reverse=True)[:10]

            if not top:
                text = f"📊 Sem dados disponíveis para {sector}."
            else:
                lines = [f"🏢 <b>{sector}</b>", ""]
                for r in top:
                    price = r.get("price")
                    chg = r.get("change_pct")
                    price_str = f"${price:.2f}" if price else "—"
                    chg_str = ""
                    if chg is not None:
                        sign = "+" if chg >= 0 else ""
                        chg_str = f"  {sign}{chg:.2f}%"
                    lines.append(f"<b>{r['ticker']}</b>  {price_str}{chg_str}")
                text = "\n".join(lines)
    except Exception as e:
        text = f"❌ Erro ao buscar setor: {e}"

    back_markup = InlineKeyboardMarkup([
        [InlineKeyboardButton("🔙 Setores", callback_data="get_sectors")],
        [InlineKeyboardButton("🏠 Menu Principal", callback_data="send_menu")],
    ])
    await update.callback_query.edit_message_text(
        text, reply_markup=back_markup, parse_mode=ParseMode.HTML
    )


async def cb_get_gainers(update: Update, context: ContextTypes.DEFAULT_TYPE):
    _log(update.effective_chat.id, "maiores_altas")
    await update.callback_query.answer("Buscando maiores altas...")
    try:
        text = await _build_movers_text("gainers")
    except Exception as e:
        text = f"❌ Erro ao buscar dados: {e}"
    await update.callback_query.edit_message_text(
        text, reply_markup=_back_markup(), parse_mode=ParseMode.HTML
    )


async def cb_get_losers(update: Update, context: ContextTypes.DEFAULT_TYPE):
    _log(update.effective_chat.id, "maiores_baixas")
    await update.callback_query.answer("Buscando maiores baixas...")
    try:
        text = await _build_movers_text("losers")
    except Exception as e:
        text = f"❌ Erro ao buscar dados: {e}"
    await update.callback_query.edit_message_text(
        text, reply_markup=_back_markup(), parse_mode=ParseMode.HTML
    )


async def cb_get_summary(update: Update, context: ContextTypes.DEFAULT_TYPE):
    _log(update.effective_chat.id, "resumo_dia")
    await update.callback_query.answer("Buscando resumo...")
    try:
        subject, body = await asyncio.to_thread(_fetch_gurufocus_body)
        news = _parse_stock_news(body)

        if "First Look" in subject:
            header = "🌅 <b>FIRST LOOK — Resumo da Manhã</b>"
        elif "Market Today" in subject:
            header = "🌙 <b>MARKET TODAY — Resumo do Dia</b>"
        else:
            header = "📰 <b>RESUMO DO DIA</b>"

        if not news:
            text = "📰 Sem notícias disponíveis no momento."
        else:
            items = [
                f"{i}. {item[:297] + '...' if len(item) > 300 else item}"
                for i, item in enumerate(news, 1)
            ]
            text = f"{header}\n\n" + "\n\n".join(items)
            if len(text) > _MAX_MSG:
                kept = list(items)
                while len(kept) > 1:
                    kept.pop()
                    text = f"{header}\n\n" + "\n\n".join(kept)
                    if len(text) <= _MAX_MSG:
                        break
    except Exception as e:
        text = f"❌ Erro ao buscar resumo: {e}"

    await update.callback_query.edit_message_text(
        text, reply_markup=_back_markup(), parse_mode=ParseMode.HTML
    )


async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    ticker = update.message.text.strip().upper()
    if not ticker or len(ticker) > 10 or not re.match(r"^[A-Z0-9.\-]+$", ticker):
        await update.message.reply_text(
            "⚠️ Digite um ticker válido (ex: AAPL, MSFT, NVDA).",
            reply_markup=_back_markup(),
            parse_mode=ParseMode.HTML,
        )
        return

    context.user_data["awaiting_ticker"] = False
    _log(update.effective_chat.id, f"analisar_acao:{ticker}")
    wait_msg = await update.message.reply_text(
        f"🔍 Analisando <b>{ticker}</b>...", parse_mode=ParseMode.HTML
    )

    try:
        try:
            peers = await asyncio.wait_for(get_peers(ticker), timeout=STEP_TIMEOUT)
        except Exception:
            peers = []

        try:
            snowflake_result = await asyncio.wait_for(
                get_snowflake_analysis(ticker, peers), timeout=STEP_TIMEOUT
            )
        except Exception as e:
            await wait_msg.edit_text(
                f"❌ Erro na análise de <b>{ticker}</b>: {e}",
                reply_markup=_back_markup(), parse_mode=ParseMode.HTML,
            )
            return

        stock = yf.Ticker(ticker)
        try:
            info = stock.info
            price = _f(info.get("currentPrice") or info.get("regularMarketPrice"))

            if price is None and not (info.get("longName") or info.get("shortName")):
                await wait_msg.edit_text(
                    f"❌ <b>Ticker '{ticker}' não encontrado.</b>\n\n"
                    f"Verifique se o símbolo está correto.\n"
                    f"<i>Exemplos: AAPL, MSFT, KLAC, NVDA</i>",
                    reply_markup=_analysis_markup(), parse_mode=ParseMode.HTML,
                )
                return

            company_name = info.get("longName") or info.get("shortName", ticker)
            sector = info.get("sector", "N/A")
            change_amount = _f(info.get("regularMarketChange"))
            prev_close_val = _f(info.get("previousClose"))
            price_data = {
                "current":    price,
                "change":     change_amount,
                "change_pct": (
                    round(change_amount / prev_close_val * 100, 2)
                    if change_amount is not None and prev_close_val
                    else None
                ),
                "market_cap": _fmt_large(info.get("marketCap")),
            }
            analysts = _fetch_analysts(price, info, stock)
        except Exception:
            await wait_msg.edit_text(
                f"❌ <b>Não foi possível buscar dados para '{ticker}'.</b>\n\n"
                f"Verifique o símbolo ou tente novamente.\n"
                f"<i>Exemplos: AAPL, MSFT, KLAC, NVDA</i>",
                reply_markup=_analysis_markup(), parse_mode=ParseMode.HTML,
            )
            return

        try:
            earnings_history = _fetch_earnings_history(stock)
        except Exception:
            earnings_history = []

        text = format_telegram_analysis(
            ticker, company_name, sector, price_data,
            snowflake_result, analysts, earnings_history,
        )
        await wait_msg.edit_text(
            _truncate(text),
            reply_markup=_analysis_markup(),
            parse_mode=ParseMode.HTML,
        )

    except Exception as e:
        await wait_msg.edit_text(
            f"❌ Erro inesperado: {e}",
            reply_markup=_back_markup(), parse_mode=ParseMode.HTML,
        )


# ---------------------------------------------------------------------------
# FastAPI lifespan — bot startup / shutdown
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _tg_app
    token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    if token:
        _tg_app = Application.builder().token(token).updater(None).build()
        _tg_app.add_handler(CommandHandler("start", cmd_start))
        _tg_app.add_handler(CommandHandler("stats", cmd_stats))
        _tg_app.add_handler(CallbackQueryHandler(cb_send_menu,        pattern="^send_menu$"))
        _tg_app.add_handler(CallbackQueryHandler(cb_ask_ticker,       pattern="^ask_ticker$"))
        _tg_app.add_handler(CallbackQueryHandler(cb_get_gainers,      pattern="^get_gainers$"))
        _tg_app.add_handler(CallbackQueryHandler(cb_get_losers,       pattern="^get_losers$"))
        _tg_app.add_handler(CallbackQueryHandler(cb_get_sectors,      pattern="^get_sectors$"))
        _tg_app.add_handler(CallbackQueryHandler(cb_get_sector_stocks, pattern="^sector:"))
        _tg_app.add_handler(CallbackQueryHandler(cb_get_summary,      pattern="^get_summary$"))
        _tg_app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
        await _tg_app.initialize()
        webhook_url = os.getenv("TELEGRAM_WEBHOOK_URL", "").rstrip("/")
        if webhook_url:
            _secret = os.getenv("TELEGRAM_WEBHOOK_SECRET", "").strip() or None
            await _tg_app.bot.set_webhook(
                url=f"{webhook_url}/webhook/telegram",
                secret_token=_secret,
            )
            print(f"[telegram] Webhook configurado: {webhook_url}/webhook/telegram")
        await _tg_app.start()
        print("[telegram] Bot iniciado.")
    else:
        print("[telegram] TELEGRAM_BOT_TOKEN não configurado — bot desativado.")
    yield
    if _tg_app:
        await _tg_app.stop()
        await _tg_app.shutdown()
        print("[telegram] Bot encerrado.")


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Stock Analysis API - Mobile",
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/webhook/telegram")
async def telegram_webhook(request: Request):
    """Receives Telegram updates via webhook."""
    if not _tg_app:
        raise HTTPException(status_code=503, detail="Telegram bot não configurado.")

    secret = os.getenv("TELEGRAM_WEBHOOK_SECRET", "")
    if secret:
        header_secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
        if header_secret != secret:
            raise HTTPException(status_code=403, detail="Token inválido.")

    data = await request.json()
    update = Update.de_json(data, _tg_app.bot)
    await _tg_app.process_update(update)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/api/analyze/{ticker}")
async def analyze(ticker: str):
    """Full JSON analysis for the desktop frontend."""
    ticker = ticker.strip().upper()
    if not ticker or len(ticker) > 10:
        raise HTTPException(status_code=400, detail="Ticker inválido.")

    try:
        peers = await asyncio.wait_for(get_peers(ticker), timeout=STEP_TIMEOUT)
    except Exception as e:
        peers = []
        print(f"Erro ao buscar peers: {e}")

    try:
        snowflake_result = await asyncio.wait_for(
            get_snowflake_analysis(ticker, peers),
            timeout=STEP_TIMEOUT,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro na análise: {str(e)}")

    company_name = ticker
    sector = "N/A"
    industry = "N/A"
    price_data = {"current": None, "currency": "USD"}
    analysts = {}
    history = []

    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        company_name = info.get("longName") or info.get("shortName", ticker)
        sector = info.get("sector", "N/A")
        industry = info.get("industry", "N/A")
        price = info.get("currentPrice") or info.get("regularMarketPrice")
        price_data = _fetch_price_data(info)
        analysts = _fetch_analysts(_f(price), info)

        try:
            hist_df = stock.history(period="1y")
            if not hist_df.empty:
                for dt, row in hist_df.iterrows():
                    history.append({
                        "date": dt.strftime("%Y-%m-%d"),
                        "close": round(float(row["Close"]), 2),
                        "volume": int(row["Volume"]),
                    })
        except Exception as e:
            print(f"Erro ao buscar histórico: {e}")

    except Exception as e:
        print(f"Erro ao buscar dados básicos: {e}")

    return {
        "ticker": ticker,
        "company_name": company_name,
        "sector": sector,
        "industry": industry,
        "price": price_data,
        "analysts": analysts,
        "snowflake": snowflake_result,
        "history": history,
        "peers": peers,
        "sources": ["Yahoo Finance"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/telegram/analyze/{ticker}")
async def telegram_analyze(ticker: str):
    """Returns HTML-formatted analysis text ready for Telegram."""
    ticker = ticker.strip().upper()
    if not ticker or len(ticker) > 10:
        raise HTTPException(status_code=400, detail="Ticker inválido.")

    try:
        peers = await asyncio.wait_for(get_peers(ticker), timeout=STEP_TIMEOUT)
    except Exception:
        peers = []

    try:
        snowflake_result = await asyncio.wait_for(
            get_snowflake_analysis(ticker, peers),
            timeout=STEP_TIMEOUT,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro na análise: {str(e)}")

    company_name = ticker
    sector = "N/A"
    price_data: dict = {}
    analysts: dict = {}
    earnings_history: list = []

    stock = yf.Ticker(ticker)
    try:
        info = stock.info
        price = _f(info.get("currentPrice") or info.get("regularMarketPrice"))

        if price is None and not (info.get("longName") or info.get("shortName")):
            error_text = (
                f"❌ <b>Ticker '{ticker}' não encontrado.</b>\n\n"
                f"Verifique se o símbolo está correto.\n"
                f"<i>Exemplos: AAPL, MSFT, KLAC, NVDA</i>"
            )
            return {"ticker": ticker, "text": error_text, "parse_mode": "HTML"}

        company_name = info.get("longName") or info.get("shortName", ticker)
        sector = info.get("sector", "N/A")
        change_amount = _f(info.get("regularMarketChange"))
        prev_close_val = _f(info.get("previousClose"))
        price_data = {
            "current":    price,
            "change":     change_amount,
            "change_pct": (
                round(change_amount / prev_close_val * 100, 2)
                if change_amount is not None and prev_close_val
                else None
            ),
            "market_cap": _fmt_large(info.get("marketCap")),
        }
        analysts = _fetch_analysts(price, info, stock)
    except Exception as e:
        print(f"Erro ao buscar dados básicos: {e}")
        error_text = (
            f"❌ <b>Não foi possível buscar dados para '{ticker}'.</b>\n\n"
            f"Verifique se o símbolo está correto ou tente novamente.\n"
            f"<i>Exemplos: AAPL, MSFT, KLAC, NVDA</i>"
        )
        return {"ticker": ticker, "text": error_text, "parse_mode": "HTML"}

    try:
        earnings_history = _fetch_earnings_history(stock)
    except Exception as e:
        print(f"Erro ao buscar earnings history: {e}")

    text = format_telegram_analysis(
        ticker, company_name, sector, price_data, snowflake_result, analysts, earnings_history
    )

    return {"ticker": ticker, "text": text, "parse_mode": "HTML"}


@app.get("/api/market/movers")
async def market_movers(type: str = "gainers", limit: int = 5):
    if type not in ("gainers", "losers"):
        raise HTTPException(status_code=400, detail="type deve ser 'gainers' ou 'losers'")
    limit = max(1, min(15, limit))

    try:
        results = await asyncio.to_thread(_yf_screen_movers, type, limit)
        return {
            "type":    type,
            "date":    datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "results": results,
            "empty":   len(results) == 0,
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[movers] erro screener: {e}")
        raise HTTPException(status_code=502, detail=f"Erro ao buscar movers: {str(e)}")


@app.get("/api/market/sectors")
async def market_sectors_list():
    return {"sectors": SECTOR_NAMES}


@app.get("/api/market/sector/{sector_name}")
async def market_sector_stocks(sector_name: str, limit: int = 10):
    normalized = SECTOR_NORMALIZE.get(sector_name.lower(), sector_name)
    tickers = get_fallback_peers(normalized)
    if not tickers:
        raise HTTPException(status_code=404, detail=f"Setor '{sector_name}' não encontrado.")

    limit = max(1, min(10, limit))

    async def _fetch(sym: str):
        def _get():
            fi = yf.Ticker(sym).fast_info
            return (
                getattr(fi, "market_cap", None),
                getattr(fi, "last_price", None),
                getattr(fi, "previous_close", None),
            )
        try:
            cap, price, prev = await asyncio.to_thread(_get)
            chg = round((price - prev) / prev * 100, 2) if price and prev and prev > 0 else None
            return {
                "ticker":         sym,
                "price":          round(float(price), 2) if price else None,
                "change_pct":     chg,
                "market_cap":     float(cap) if cap else 0,
                "market_cap_fmt": _fmt_large(cap),
            }
        except Exception:
            return None

    raw = await asyncio.gather(*[_fetch(sym) for sym in tickers])
    valid = [r for r in raw if r and r.get("market_cap", 0) > 0]
    top = sorted(valid, key=lambda x: x["market_cap"], reverse=True)[:limit]
    for s in top:
        s.pop("market_cap", None)

    return {"sector": normalized, "results": top}


@app.get("/api/market/summary")
async def market_summary():
    try:
        subject, body = await asyncio.to_thread(_fetch_gurufocus_body)
        news = _parse_stock_news(body)

        if "First Look" in subject:
            email_type = "First Look"
        elif "Market Today" in subject:
            email_type = "Market Today"
        else:
            email_type = "GuruFocus"

        return {
            "date":       datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "email_type": email_type,
            "subject":    subject,
            "news":       news,
            "empty":      len(news) == 0,
        }

    except Exception as e:
        print(f"[summary] erro: {e}")
        raise HTTPException(status_code=502, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
