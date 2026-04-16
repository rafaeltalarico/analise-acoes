import yfinance as yf
import asyncio
import math
from typing import List, Optional, Dict, Any


SECTOR_KEY_MAP = {
    "Basic Materials": "basic-materials",
    "Communication Services": "communication-services",
    "Consumer Cyclical": "consumer-cyclical",
    "Consumer Defensive": "consumer-defensive",
    "Energy": "energy",
    "Financial Services": "financial-services",
    "Healthcare": "healthcare",
    "Industrials": "industrials",
    "Real Estate": "real-estate",
    "Technology": "technology",
    "Utilities": "utilities",
}


def safe_float(value, multiplier=1.0) -> Optional[float]:
    try:
        if value is None or (isinstance(value, float) and math.isnan(value)):
            return None
        return round(float(value) * multiplier, 4)
    except (TypeError, ValueError):
        return None


def format_market_cap(value) -> Optional[str]:
    try:
        if value is None:
            return None
        v = float(value)
        if abs(v) >= 1e12:
            return f"{v/1e12:.2f}T"
        if abs(v) >= 1e9:
            return f"{v/1e9:.2f}B"
        if abs(v) >= 1e6:
            return f"{v/1e6:.2f}M"
        return f"{v:.0f}"
    except (TypeError, ValueError):
        return None


def fetch_peer_data(ticker: str) -> Dict[str, Any]:
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        if not info:
            return {"ticker": ticker, "error": True}

        current_price = safe_float(info.get("currentPrice") or info.get("regularMarketPrice"))
        prev_close = safe_float(info.get("previousClose") or info.get("regularMarketPreviousClose"))
        change_pct = None
        if current_price and prev_close and prev_close != 0:
            change_pct = round(((current_price - prev_close) / prev_close) * 100, 2)

        return {
            "ticker": ticker.upper(),
            "company_name": info.get("shortName") or info.get("longName"),
            "price": current_price,
            "change_pct": change_pct,
            "pe_forward": safe_float(info.get("forwardPE")),
            "pe_trailing": safe_float(info.get("trailingPE")),
            "price_to_book": safe_float(info.get("priceToBook")),
            "market_cap": format_market_cap(info.get("marketCap")),
            "net_margin": safe_float(info.get("profitMargins"), 100),
            "roe": safe_float(info.get("returnOnEquity"), 100),
            "earnings_growth": safe_float(info.get("earningsGrowth"), 100),
            "revenue_growth": safe_float(info.get("revenueGrowth"), 100),
            "dividend_yield": safe_float(info.get("dividendYield"), 100),
            "beta": safe_float(info.get("beta")),
        }
    except Exception:
        return {"ticker": ticker, "error": True}


async def get_peers_data(main_ticker: str, sector_name: Optional[str]) -> List[Dict[str, Any]]:
    if not sector_name:
        return []

    sector_key = SECTOR_KEY_MAP.get(sector_name)
    if not sector_key:
        return []

    peer_tickers = []
    try:
        sector = yf.Sector(sector_key)
        top_companies = sector.top_companies
        if top_companies is not None and not top_companies.empty:
            all_symbols = top_companies["symbol"].tolist() if "symbol" in top_companies.columns else top_companies.index.tolist()
            peer_tickers = [t for t in all_symbols if t.upper() != main_ticker.upper()][:4]
    except Exception:
        return []

    if not peer_tickers:
        return []

    loop = asyncio.get_event_loop()
    tasks = [
        loop.run_in_executor(None, fetch_peer_data, ticker)
        for ticker in peer_tickers
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    peers = []
    for result in results:
        if isinstance(result, Exception):
            continue
        if isinstance(result, dict) and not result.get("error"):
            peers.append(result)

    return peers
