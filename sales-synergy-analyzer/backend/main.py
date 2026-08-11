import asyncio
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

import yfinance as yf
import pandas as pd

from services.snowflake_service import get_snowflake_analysis, get_peers, get_fallback_peers

app = FastAPI(title="Stock Analysis API - Mobile", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STEP_TIMEOUT = 30

# Curated list of liquid US stocks for market movers feature
LIQUID_STOCKS = list(dict.fromkeys([
    # Mega Cap Tech
    "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AVGO", "ORCL", "ADBE",
    # Large Cap Tech
    "AMD", "INTC", "QCOM", "CRM", "NFLX", "IBM", "TXN", "AMAT", "MU", "NOW",
    # Healthcare
    "UNH", "JNJ", "LLY", "ABBV", "MRK", "PFE", "TMO", "ABT", "DHR", "CVS",
    # Financials
    "JPM", "BAC", "WFC", "GS", "MS", "V", "MA", "AXP", "BLK", "C",
    # Consumer
    "HD", "MCD", "NKE", "SBUX", "TGT", "COST", "WMT", "LOW", "TJX",
    # Energy
    "XOM", "CVX", "COP", "SLB", "EOG", "OXY",
    # Industrials
    "GE", "BA", "CAT", "HON", "UNP", "UPS", "DE", "LMT", "RTX",
    # Communication
    "DIS", "CMCSA", "WBD",
    # Defensive / Other
    "PG", "KO", "PEP", "CL", "PM", "NEE", "DUK", "PLD", "AMT", "EQIX",
]))

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


def _fetch_analysts(price: Optional[float], info: dict) -> dict:
    return {
        "price_target": {
            "current": price,
            "mean":    _f(info.get("targetMeanPrice")),
            "low":     _f(info.get("targetLowPrice")),
            "high":    _f(info.get("targetHighPrice")),
        },
        "recommendation":     info.get("recommendationKey", "N/A"),
        "number_of_analysts": info.get("numberOfAnalystOpinions"),
    }


def _get_close_df(data: pd.DataFrame) -> pd.DataFrame:
    """Extract Close prices safely across yfinance column structures."""
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


def _fetch_earnings_history(stock: yf.Ticker) -> list:
    """Returns up to 6 past quarters of LPA (EPS) and Revenue actual vs estimate."""
    try:
        df = stock.earnings_dates
        if df is None or df.empty:
            return []

        past = df[df["Reported EPS"].notna()].sort_index(ascending=False).head(6)
        if past.empty:
            return []

        has_rev = "Reported Revenue" in df.columns and "Revenue Estimate" in df.columns

        results = []
        for dt, row in past.iterrows():
            ts = pd.Timestamp(dt)
            date_label = ts.strftime("%b %Y")

            lpa_est = row.get("EPS Estimate")
            lpa_act = row.get("Reported EPS")
            lpa_surp = row.get("Surprise(%)")

            lpa_est_f = None if (lpa_est is None or pd.isna(lpa_est)) else round(float(lpa_est), 2)
            lpa_act_f = None if (lpa_act is None or pd.isna(lpa_act)) else round(float(lpa_act), 2)
            lpa_surp_f = None if (lpa_surp is None or pd.isna(lpa_surp)) else round(float(lpa_surp), 2)

            lpa_beat = None
            if lpa_act_f is not None and lpa_est_f is not None:
                lpa_beat = True if lpa_act_f > lpa_est_f else (False if lpa_act_f < lpa_est_f else None)

            entry = {
                "date": date_label,
                "lpa_estimate": lpa_est_f,
                "lpa_actual": lpa_act_f,
                "lpa_surprise_pct": lpa_surp_f,
                "lpa_beat": lpa_beat,
                "rev_estimate": None,
                "rev_actual": None,
                "rev_surprise_pct": None,
                "rev_beat": None,
            }

            if has_rev:
                rev_est = row.get("Revenue Estimate")
                rev_act = row.get("Reported Revenue")
                rev_surp = row.get("Revenue Surprise(%)")

                rev_est_f = None if (rev_est is None or pd.isna(rev_est)) else float(rev_est)
                rev_act_f = None if (rev_act is None or pd.isna(rev_act)) else float(rev_act)
                rev_surp_f = None if (rev_surp is None or pd.isna(rev_surp)) else round(float(rev_surp), 2)

                rev_beat = None
                if rev_act_f is not None and rev_est_f is not None:
                    rev_beat = True if rev_act_f > rev_est_f else (False if rev_act_f < rev_est_f else None)

                entry["rev_estimate"] = rev_est_f
                entry["rev_actual"] = rev_act_f
                entry["rev_surprise_pct"] = rev_surp_f
                entry["rev_beat"] = rev_beat

            results.append(entry)

        return results
    except Exception as e:
        print(f"Erro ao buscar earnings history: {e}")
        return []


def _fmt_rev(value) -> str:
    """Format revenue value as B/M string."""
    if value is None:
        return "—"
    abs_v = abs(value)
    if abs_v >= 1e12:
        return f"${value/1e12:.2f}T"
    if abs_v >= 1e9:
        return f"${value/1e9:.2f}B"
    if abs_v >= 1e6:
        return f"${value/1e6:.2f}M"
    return f"${value:.0f}"


def _format_earnings_section(earnings: list) -> str:
    if not earnings:
        return ""

    has_rev = any(e.get("rev_actual") is not None for e in earnings)

    lines = ["", "<b>📊 RESULTADOS TRIMESTRAIS</b>"]

    for e in earnings:
        lpa_act = e.get("lpa_actual")
        if lpa_act is None:
            continue

        date     = e.get("date", "")
        lpa_est  = e.get("lpa_estimate")
        lpa_surp = e.get("lpa_surprise_pct")
        lpa_beat = e.get("lpa_beat")

        lpa_icon  = "✅" if lpa_beat is True else ("❌" if lpa_beat is False else "➖")
        lpa_label = "Beat" if lpa_beat is True else ("Miss" if lpa_beat is False else "  —  ")

        lpa_est_str  = f" est:${lpa_est:.2f}" if lpa_est is not None else ""
        lpa_surp_str = ""
        if lpa_surp is not None:
            sign = "+" if lpa_surp >= 0 else ""
            lpa_surp_str = f" {sign}{lpa_surp:.1f}%"

        lines.append(f"<code>{date:<8}  LPA {lpa_icon} {lpa_label}  ${lpa_act:.2f}{lpa_est_str}{lpa_surp_str}</code>")

        if has_rev:
            rev_act  = e.get("rev_actual")
            rev_est  = e.get("rev_estimate")
            rev_surp = e.get("rev_surprise_pct")
            rev_beat = e.get("rev_beat")

            rev_icon  = "✅" if rev_beat is True else ("❌" if rev_beat is False else "➖")
            rev_label = "Beat" if rev_beat is True else ("Miss" if rev_beat is False else "  —  ")

            rev_act_str = _fmt_rev(rev_act) if rev_act is not None else "—"
            rev_est_str = f" est:{_fmt_rev(rev_est)}" if rev_est is not None else ""
            rev_surp_str = ""
            if rev_surp is not None:
                sign = "+" if rev_surp >= 0 else ""
                rev_surp_str = f" {sign}{rev_surp:.1f}%"

            lines.append(f"<code>         REC {rev_icon} {rev_label}  {rev_act_str}{rev_est_str}{rev_surp_str}</code>")

    return "\n".join(lines)


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
    low_pt = pt.get("low")
    high_pt = pt.get("high")
    recommendation = analysts.get("recommendation", "")
    n_analysts = analysts.get("number_of_analysts")

    if mean or low_pt or high_pt:
        lines += ["", "<b>🎯 PRICE TARGET (Consenso)</b>"]
        if low_pt:
            lines.append(f"Baixo:  ${low_pt:.2f}")
        if mean:
            upside_str = ""
            if price:
                upside_pct = (mean - price) / price * 100
                sign = "+" if upside_pct >= 0 else ""
                upside_str = f"  ({sign}{upside_pct:.1f}% upside)"
            lines.append(f"Médio:  ${mean:.2f}{upside_str}")
        if high_pt:
            lines.append(f"Alto:   ${high_pt:.2f}")
        if recommendation and recommendation not in ("N/A", "none", ""):
            rec_map = {
                "strong_buy":  "Strong Buy 🟢",
                "buy":         "Buy 🟢",
                "hold":        "Hold 🟡",
                "sell":        "Sell 🔴",
                "strong_sell": "Strong Sell 🔴",
            }
            rec_label = rec_map.get(recommendation, recommendation.replace("_", " ").title())
            n_str = f" ({n_analysts} analistas)" if n_analysts else ""
            lines.append(f"📌 Recomendação: {rec_label}{n_str}")

    # Earnings history section
    if earnings:
        section = _format_earnings_section(earnings)
        if section:
            lines.append(section)

    return "\n".join(lines)


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
        company_name = info.get("longName") or info.get("shortName", ticker)
        sector = info.get("sector", "N/A")
        price = _f(info.get("currentPrice") or info.get("regularMarketPrice"))
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
        analysts = _fetch_analysts(price, info)
    except Exception as e:
        print(f"Erro ao buscar dados básicos: {e}")

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
    """Top gainers or losers from a curated list of liquid US stocks."""
    if type not in ("gainers", "losers"):
        raise HTTPException(status_code=400, detail="type deve ser 'gainers' ou 'losers'")
    limit = max(1, min(15, limit))

    try:
        data = await asyncio.to_thread(
            lambda: yf.download(
                LIQUID_STOCKS,
                period="2d",
                interval="1d",
                progress=False,
                auto_adjust=True,
            )
        )

        close = _get_close_df(data)
        if close.empty or len(close) < 2:
            raise HTTPException(status_code=502, detail="Dados de mercado insuficientes.")

        changes = {}
        for sym in LIQUID_STOCKS:
            if sym in close.columns:
                prev = close[sym].iloc[-2]
                curr = close[sym].iloc[-1]
                if pd.notna(prev) and pd.notna(curr) and float(prev) > 0:
                    changes[sym] = round((float(curr) - float(prev)) / float(prev) * 100, 2)

        sorted_pairs = sorted(
            changes.items(),
            key=lambda x: x[1],
            reverse=(type == "gainers"),
        )

        results = []
        for sym, chg_pct in sorted_pairs[:limit]:
            curr_price = float(close[sym].iloc[-1])
            prev_price = float(close[sym].iloc[-2])
            results.append({
                "ticker":     sym,
                "price":      round(curr_price, 2),
                "change":     round(curr_price - prev_price, 2),
                "change_pct": chg_pct,
            })

        return {
            "type": type,
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "results": results,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro ao buscar movers: {str(e)}")


@app.get("/api/market/sectors")
async def market_sectors_list():
    """Returns the list of available sector names."""
    return {"sectors": SECTOR_NAMES}


@app.get("/api/market/sector/{sector_name}")
async def market_sector_stocks(sector_name: str, limit: int = 10):
    """Top stocks in a sector sorted by market cap (descending)."""
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
