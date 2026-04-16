import os
import json
import re
import anthropic
from typing import Optional, Dict, Any

MODEL = "claude-haiku-4-5"


def get_client() -> Optional[anthropic.Anthropic]:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    return anthropic.Anthropic(api_key=api_key)


async def generate_earnings_summary(sec_text: str) -> Optional[Dict[str, Any]]:
    client = get_client()
    if not client:
        return None

    prompt = f"""Você é um analista financeiro. Leia este earnings release e responda em português com:
(1) EPS real vs estimativa — beat ou miss e por quanto;
(2) Receita real vs estimativa — beat ou miss;
(3) Três principais destaques operacionais em bullet points;
(4) Outlook e guidance mencionados;
(5) Tom geral em uma palavra: POSITIVO, NEUTRO ou NEGATIVO.

Retorne APENAS JSON válido no formato:
{{
  "sentiment": "POSITIVO",
  "text": "resumo geral de 2-3 frases",
  "highlights": ["highlight 1", "highlight 2", "highlight 3"],
  "outlook": "descrição do outlook/guidance"
}}

Earnings release:
{sec_text}"""

    try:
        import asyncio
        loop = asyncio.get_event_loop()

        def call_claude():
            message = client.messages.create(
                model=MODEL,
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}]
            )
            return message.content[0].text

        raw = await loop.run_in_executor(None, call_claude)

        # Extract JSON from response
        match = re.search(r'\{[\s\S]*\}', raw)
        if match:
            return json.loads(match.group())
    except Exception:
        pass

    return None


async def generate_scores(metrics: Dict[str, Any], sector: Optional[str]) -> Optional[Dict[str, Any]]:
    client = get_client()
    if not client:
        return None

    sector_str = sector or "Technology"
    metrics_json = json.dumps(metrics, indent=2, default=str)

    prompt = f"""Você é um analista financeiro especialista em avaliação de ações.
Com base nos dados fornecidos, atribua scores de 1 a 10 para cada bloco abaixo.
Para cada score, forneça uma justificativa de 1 linha em português.

Retorne APENAS JSON válido no formato:
{{
  "financial_strength": {{"score": 7, "justificativa": "...", "detalhes": {{"cash_to_debt": "...", "debt_equity": "...", "piotroski": "..."}}}},
  "profitability": {{"score": 8, "justificativa": "...", "detalhes": {{"net_margin": "...", "roe": "...", "roa": "..."}}}},
  "growth": {{"score": 6, "justificativa": "...", "detalhes": {{"revenue_3y": "...", "eps_3y": "...", "forward_growth": "..."}}}},
  "valuation": {{"score": 9, "justificativa": "...", "detalhes": {{"pe_forward": "...", "pb": "...", "peg": "..."}}}},
  "momentum": {{"score": 7, "justificativa": "...", "detalhes": {{"vs_52w_high": "...", "analyst_consensus": "..."}}}}
}}

Compare os indicadores com benchmarks típicos do setor {sector_str} e com padrões históricos de empresas saudáveis.

Dados da empresa:
{metrics_json}"""

    try:
        import asyncio
        loop = asyncio.get_event_loop()

        def call_claude():
            message = client.messages.create(
                model=MODEL,
                max_tokens=2048,
                messages=[{"role": "user", "content": prompt}]
            )
            return message.content[0].text

        raw = await loop.run_in_executor(None, call_claude)

        match = re.search(r'\{[\s\S]*\}', raw)
        if match:
            return json.loads(match.group())
    except Exception:
        pass

    return None


async def _noop() -> None:
    return None


async def run_claude_analysis(
    metrics: Dict[str, Any],
    sector: Optional[str],
    sec_text: Optional[str],
) -> Dict[str, Any]:
    import asyncio

    earnings_task = generate_earnings_summary(sec_text) if sec_text else _noop()
    results = await asyncio.gather(
        generate_scores(metrics, sector),
        earnings_task,
        return_exceptions=True,
    )

    scores_raw = results[0] if not isinstance(results[0], Exception) else None
    earnings_raw = results[1] if not isinstance(results[1], Exception) else None

    return {"scores": scores_raw, "earnings": earnings_raw}
