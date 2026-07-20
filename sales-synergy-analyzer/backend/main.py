import asyncio
from datetime import datetime, timezone
import json  # ADICIONE ESTE IMPORT

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
    print(f"🚀 Iniciando análise para {ticker}")
    print(f"{'='*60}")
    
    # Busca peers
    try:
        print("📊 Buscando peers...")
        peers = await asyncio.wait_for(
            get_peers(ticker),
            timeout=STEP_TIMEOUT
        )
        print(f"✅ Encontrados {len(peers)} peers")
        if peers:
            print(f"📋 Primeiros peers: {[p.get('symbol') for p in peers[:5]]}")
    except Exception as e:
        peers = []
        print(f"❌ Erro ao buscar peers: {e}")

    # Executa análise Snowflake
    try:
        print("\n🔍 Executando análise Snowflake...")
        snowflake_result = await asyncio.wait_for(
            get_snowflake_analysis(ticker, peers),
            timeout=STEP_TIMEOUT
        )
        print("✅ Análise Snowflake concluída")
    except Exception as e:
        print(f"❌ Erro na análise: {e}")
        raise HTTPException(status_code=502, detail=f"Erro na análise: {str(e)}")

    # Converte Snowflake para o formato antigo (compatível com frontend)
    scores = {}
    metrics_summary = []
    
    # Mapeamento de categorias Snowflake para o formato antigo
    category_mapping = {
        "value": "Valuation",
        "future": "Crescimento Futuro",
        "past": "Desempenho Passado",
        "health": "Saúde Financeira",
        "dividend": "Dividendos"
    }
    
    print("\n📊 Processando categorias...")
    for category, display_name in category_mapping.items():
        if category in snowflake_result:
            data = snowflake_result[category]
            scores[category] = {
                "score": data.get("score", 0),
                "max": data.get("max", 0),
                "label": display_name,
                "checks": data.get("checks", [])
            }
            print(f"  ✅ {display_name}: {data.get('score', 0)}/{data.get('max', 0)}")
            
            # Adiciona à métricas summary
            for check in data.get("checks", []):
                if check.get("passed") is not None:
                    metrics_summary.append({
                        "category": display_name,
                        "label": check.get("label"),
                        "status": "positivo" if check.get("passed") else "negativo" if check.get("passed") is False else "neutro",
                        "detail": check.get("detail")
                    })

    # Calcula score geral
    total_score = sum(data.get("score", 0) for data in snowflake_result.values())
    total_max = sum(data.get("max", 0) for data in snowflake_result.values())
    overall_score = round((total_score / total_max * 100) if total_max > 0 else 0)
    print(f"\n📈 Score Geral: {total_score}/{total_max} = {overall_score}%")

    # Busca dados básicos do Yahoo para compatibilidade
    history = []
    try:
        import yfinance as yf
        stock = yf.Ticker(ticker)
        info = stock.info
        
        company_name = info.get("longName", ticker)
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

        # Complete price data for frontend
        change_amount  = _f(info.get("regularMarketChange"))
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

        # Price target dos analistas
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
        print(f"🏢 Empresa: {company_name}")
        print(f"💰 Preço: ${price} | Change: {change_amount} ({change_pct_val}%)")
        print(f"🎯 Price target: low=${price_target['low']} mean=${price_target['mean']} high=${price_target['high']}")
        print(f"📊 Recomendação: {analysts['recommendation']}")

        # Histórico de preços (12 meses)
        history = []
        try:
            hist_df = stock.history(period="1y")
            if not hist_df.empty:
                for dt, row in hist_df.iterrows():
                    history.append({
                        "date": dt.strftime("%Y-%m-%d"),
                        "close": round(float(row["Close"]), 2),
                        "volume": int(row["Volume"]),
                    })
            print(f"📅 Histórico: {len(history)} pontos")
        except Exception as e:
            print(f"⚠️ Erro ao buscar histórico: {e}")
    except Exception as e:
        print(f"⚠️ Erro ao buscar dados básicos: {e}")
        company_name = ticker
        sector = "N/A"
        industry = "N/A"
        price = None
        price_data = {"current": None, "currency": "USD"}
        analysts = {}
        history = []

    # EXIBE O RESULTADO COMPLETO NO TERMINAL
    print(f"\n{'='*60}")
    print(f"📋 RESULTADO COMPLETO DA ANÁLISE PARA {ticker}")
    print(f"{'='*60}")
    
    # Exibe cada categoria com seus checks
    for category, display_name in category_mapping.items():
        if category in snowflake_result:
            data = snowflake_result[category]
            print(f"\n📂 {display_name} ({data.get('score', 0)}/{data.get('max', 0)})")
            print("-" * 50)
            for check in data.get("checks", []):
                status_icon = "✅" if check.get("passed") is True else "❌" if check.get("passed") is False else "➖"
                print(f"  {status_icon} {check.get('label')}")
                print(f"     📝 {check.get('detail')}")
    
    print(f"\n{'='*60}")
    print(f"📊 SCORE GERAL: {overall_score}% ({total_score}/{total_max})")
    print(f"{'='*60}\n")

    # Retorna no formato que o frontend espera
    response = {
        "ticker": ticker,
        "company_name": company_name,
        "sector": sector,
        "industry": industry,
        "price": price_data,
        "scores": scores,
        "metrics": {},
        "metrics_summary": metrics_summary,
        "analysts": analysts,
        "earnings_summary": {
            "available": False,
            "text": "Dados de earnings disponíveis via análise Snowflake"
        },
        "peers": peers,
        "snowflake": snowflake_result,
        "overall_score": overall_score,
        "history": history,
        "sources": ["Yahoo Finance", "Snowflake Analysis"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": "success"
    }
    
    return response


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)