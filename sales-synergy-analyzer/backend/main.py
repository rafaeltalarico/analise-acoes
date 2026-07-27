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
    "healthcare": "Healthcare",
    "financial": "Financial Services",
    "financial services": "Financial Services",
    "consumer cyclical": "Consumer Cyclical",
    "communication": "Communication Services",
    "communication services": "Communication Services",
    "energy": "Energy",
    "industrials": "Industrials",
    "industrial": "Industrials",
    "consumer defensive": "Consumer Defensive",
    "utilities": "Utilities",
    "real estate": "Real Estate",
    "basic materials": "Basic Materials",
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


def format_telegram_analysis(
    ticker: str,
    company_name: str,
    sector: str,
    price_data: dict,
    snowflake: dict,
    analysts: dict,
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

    try:
        stock = yf.Ticker(ticker)
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

    text = format_telegram_analysis(
        ticker, company_name, sector, price_data, snowflake_result, analysts
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
async def market_sector_stocks(sector_name: str, limit: int = 5):
    """Top stocks in a sector with their day price change."""
    normalized = SECTOR_NORMALIZE.get(sector_name.lower(), sector_name)
    tickers = get_fallback_peers(normalized)
    if not tickers:
        raise HTTPException(status_code=404, detail=f"Setor '{sector_name}' não encontrado.")

    limit = max(1, min(10, limit))
    tickers = tickers[: limit + 3]

    try:
        data = await asyncio.to_thread(
            lambda: yf.download(
                tickers,
                period="2d",
                interval="1d",
                progress=False,
                auto_adjust=True,
            )
        )

        close = _get_close_df(data)

        results = []
        for sym in tickers:
            if len(results) >= limit:
                break
            try:
                curr = float(close[sym].iloc[-1]) if sym in close.columns and len(close) >= 1 else None
                prev = float(close[sym].iloc[-2]) if sym in close.columns and len(close) >= 2 else None
                chg_pct = (
                    round((curr - prev) / prev * 100, 2)
                    if curr and prev and prev > 0
                    else None
                )
                results.append({
                    "ticker":     sym,
                    "price":      round(curr, 2) if curr else None,
                    "change_pct": chg_pct,
                })
            except Exception:
                continue

        return {"sector": normalized, "results": results}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro ao buscar setor: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
