import asyncio
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from services.snowflake_service import get_snowflake_analysis, get_peers

app = FastAPI(title="Stock Analysis API - Snowflake", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:8080",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STEP_TIMEOUT = 30


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/api/analyze/{ticker}")
async def analyze(ticker: str):
    ticker = ticker.strip().upper()
    if not ticker or len(ticker) > 10:
        raise HTTPException(status_code=400, detail="Ticker inválido.")

    print(f"\n{'='*60}")
    print(f"Iniciando análise para {ticker}")
    print(f"{'='*60}")

    # Busca peers
    try:
        peers = await asyncio.wait_for(get_peers(ticker), timeout=STEP_TIMEOUT)
        print(f"Encontrados {len(peers)} peers")
    except Exception as e:
        peers = []
        print(f"Erro ao buscar peers: {e}")

    # Executa análise Snowflake
    try:
        snowflake_result = await asyncio.wait_for(
            get_snowflake_analysis(ticker, peers),
            timeout=STEP_TIMEOUT,
        )
        print("Análise Snowflake concluída")
    except Exception as e:
        print(f"Erro na análise: {e}")
        raise HTTPException(status_code=502, detail=f"Erro na análise: {str(e)}")

    # Busca dados básicos via yfinance
    company_name = ticker
    sector = "N/A"
    industry = "N/A"
    price_data = {"current": None, "currency": "USD"}
    analysts = {}
    history = []

    try:
        import yfinance as yf
        stock = yf.Ticker(ticker)
        info = stock.info

        company_name = info.get("longName") or info.get("shortName", ticker)
        sector = info.get("sector", "N/A")
        industry = info.get("industry", "N/A")
        price = info.get("currentPrice") or info.get("regularMarketPrice")

        def _f(v):
            try:
                return round(float(v), 2) if v is not None else None
            except Exception:
                return None

        def _fmt_large(v):
            try:
                n = float(v)
                if n >= 1_000_000_000_000: return f"{n/1e12:.2f}T"
                if n >= 1_000_000_000:     return f"{n/1e9:.2f}B"
                if n >= 1_000_000:         return f"{n/1e6:.2f}M"
                return f"{n:,.0f}"
            except Exception:
                return None

        change_amount = _f(info.get("regularMarketChange"))
        prev_close_val = _f(info.get("previousClose"))
        change_pct_val = (
            round(change_amount / prev_close_val * 100, 2)
            if change_amount is not None and prev_close_val
            else None
        )
        price_data = {
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

        price_target = {
            "current": _f(price),
            "mean":    _f(info.get("targetMeanPrice")),
            "low":     _f(info.get("targetLowPrice")),
            "high":    _f(info.get("targetHighPrice")),
        }

        analysts = {
            "price_target":       price_target,
            "recommendation":     info.get("recommendationKey", "N/A"),
            "number_of_analysts": info.get("numberOfAnalystOpinions"),
        }

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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
