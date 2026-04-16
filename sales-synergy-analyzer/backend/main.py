import asyncio
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from services.yahoo_service import get_stock_data
from services.peers_service import get_peers_data
from services.sec_service import get_earnings_release
from services.claude_service import run_claude_analysis

app = FastAPI(title="Stock Analysis API", version="1.0.0")

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

STEP_TIMEOUT = 15


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/api/analyze/{ticker}")
async def analyze(ticker: str):
    ticker = ticker.strip().upper()
    if not ticker or len(ticker) > 10:
        raise HTTPException(status_code=400, detail="Ticker inválido.")

    # Step 1: Yahoo Finance data
    try:
        yahoo_data = await asyncio.wait_for(get_stock_data(ticker), timeout=STEP_TIMEOUT)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Timeout ao buscar dados do Yahoo Finance.")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro ao buscar dados: {str(e)}")

    sector = yahoo_data.get("sector")
    metrics = yahoo_data.get("metrics", {})

    # Steps 2 + 3 in parallel: peers and SEC
    try:
        peers_result, sec_result = await asyncio.wait_for(
            asyncio.gather(
                get_peers_data(ticker, sector),
                get_earnings_release(ticker),
                return_exceptions=True,
            ),
            timeout=STEP_TIMEOUT,
        )
    except asyncio.TimeoutError:
        peers_result = []
        sec_result = {"sec_available": False}

    if isinstance(peers_result, Exception):
        peers_result = []
    if isinstance(sec_result, Exception):
        sec_result = {"sec_available": False}

    # Step 4: Claude — scores + earnings summary in parallel
    sec_text = sec_result.get("text") if sec_result.get("sec_available") else None
    try:
        claude_result = await asyncio.wait_for(
            run_claude_analysis(metrics, sector, sec_text),
            timeout=STEP_TIMEOUT,
        )
    except (asyncio.TimeoutError, Exception):
        claude_result = {"scores": None, "earnings": None}

    # Build sources list
    sources = ["Yahoo Finance"]
    if sec_result.get("sec_available"):
        sources.append("SEC EDGAR")
    if claude_result.get("scores") or claude_result.get("earnings"):
        sources.append("Claude API")

    # Earnings summary
    earnings_summary = {"available": False}
    if sec_result.get("sec_available") and claude_result.get("earnings"):
        ea = claude_result["earnings"]
        earnings_summary = {
            "available": True,
            "filing_date": sec_result.get("filing_date"),
            "period": None,
            "sentiment": ea.get("sentiment"),
            "text": ea.get("text"),
            "highlights": ea.get("highlights", []),
            "outlook": ea.get("outlook"),
        }
    elif sec_result.get("sec_available"):
        earnings_summary = {
            "available": True,
            "filing_date": sec_result.get("filing_date"),
            "period": None,
            "sentiment": None,
            "text": "Documento encontrado mas resumo IA indisponível.",
            "highlights": [],
            "outlook": None,
        }

    return {
        "ticker": yahoo_data["ticker"],
        "company_name": yahoo_data.get("company_name"),
        "sector": yahoo_data.get("sector"),
        "industry": yahoo_data.get("industry"),
        "price": yahoo_data.get("price", {}),
        "scores": claude_result.get("scores"),
        "metrics": metrics,
        "analysts": yahoo_data.get("analysts", {}),
        "earnings_summary": earnings_summary,
        "peers": peers_result if isinstance(peers_result, list) else [],
        "sources": sources,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
