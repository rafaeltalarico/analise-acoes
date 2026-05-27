import os
import json
import re
import anthropic
import asyncio
from dotenv import load_dotenv
from typing import Optional, Dict, Any

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
MODEL = "claude-haiku-4-5"


def get_client() -> Optional[anthropic.Anthropic]:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    return anthropic.Anthropic(api_key=api_key)

#async def generate_earnings_summary(sec_text: str) -> Optional[Dict[str, Any]]:
#    client = get_client()
#    if not client:
#        return None

#    prompt = f"""Você é um analista financeiro. Leia este earnings release e responda em português com:
#(1) EPS real vs estimativa — beat ou miss e por quanto;
#(2) Receita real vs estimativa — beat ou miss;
#(3) Três principais destaques operacionais em bullet points;
#(4) Outlook e guidance mencionados;
#(5) Tom geral em uma palavra: POSITIVO, NEUTRO ou NEGATIVO.

#Retorne APENAS JSON válido no formato:
#{{
#  "sentiment": "POSITIVO",
#  "text": "resumo geral de 2-3 frases",
#  "highlights": ["highlight 1", "highlight 2", "highlight 3"],
#  "outlook": "descrição do outlook/guidance"
#}}

#Earnings release:
#{sec_text}"""

#    try:
#        loop = asyncio.get_event_loop()

#        def call_claude():
#            response = client.messages.create(
#                model=MODEL,
#                max_tokens=1024,
#                messages=[{"role": "user", "content": prompt}]

#            return response.content[0].text

#        raw = await loop.run_in_executor(None, call_claude)

        # Remove markdown code blocks se existirem
#        clean = re.sub(r'```(?:json)?\s*', '', raw).strip()
#        clean = re.sub(r'```\s*$', '', clean).strip()

#        match = re.search(r'\{[\s\S]*\}', clean)
#        if match:
#            return json.loads(match.group())
#    except Exception as e:
#        print("Erro ao gerar resumo de earnings:", str(e))

#    return None


async def generate_scores(metrics: Dict[str, Any], sector: Optional[str]) -> Optional[Dict[str, Any]]:
    client = get_client()
    if not client:
        return None
    
    sector_str = sector or "Technology"
    metrics_json = json.dumps(metrics, indent=2, default=str)

    prompt = f"""Você é um analista financeiro especialista em avaliação de ações americanas.
Sua tarefa é analisar os dados fornecidos e atribuir scores de 1 a 10 para cada um dos 6 blocos abaixo.

INSTRUÇÕES IMPORTANTES:
- Raciocine criteriosamente antes de atribuir cada score
- Compare sempre com benchmarks típicos do setor {sector_str}
- Seja consistente: um score 10 exige excelência em todos os sub-indicadores do bloco
- Se dados de um critério não estiverem disponíveis, 
escreva apenas "Dado não disponível" e atribua score conservador.


DEFINIÇÃO DOS BLOCOS E CRITÉRIOS:

BLOCO 1 — qualidade_negocio (Qualidade do Negócio)
Avalia se a empresa é intrinsecamente lucrativa e eficiente.
Critérios: ROE, ROA, margem líquida, margem operacional, FCF margin, anos consecutivos de lucro.

BLOCO 2 — saude_financeira (Saúde Financeira)
Avalia solidez do balanço e capacidade de sobreviver a ciclos adversos.

BLOCO 3 — crescimento (Crescimento)
Avalia trajetória de crescimento passada e perspectiva futura.
Critérios: crescimento de receita e EPS nos últimos 3 anos e nos últimos 4 trimestres,
estimativas forward de analistas, tendência de expansão de margem trimestre a trimestre.

BLOCO 4 — valuation (Valuation)
Avalia se o preço atual é justo ou atrativo em relação aos fundamentos.
Critérios: P/E trailing e forward, P/B, P/S, EV/EBITDA, PEG ratio.

BLOCO 5 — momentum_mercado (Momentum e Mercado)
Avalia o que o mercado profissional espera da empresa.
Critérios: consenso de analistas (Buy/Hold/Sell), price target médio vs preço atual,
upgrades e downgrades recentes, upside implícito.

BLOCO 6 — comportamento_preco (Comportamento do Preço)
Avalia se o ativo tem o perfil gráfico de um compounder de longo prazo com
tendência sustentada — NÃO premia estar na máxima histórica, mas sim ter
tendência clara e estar em zona de entrada favorável.
Critérios: retorno em 1, 3 e 5 anos, posição no range de 52 semanas,
distância da máxima histórica, preço vs média móvel de 200 dias,
consistência (quantos anos fecharam positivos nos últimos 5), volatilidade anualizada.

Retorne APENAS JSON válido no seguinte formato, sem justificativas, detalhes e texto adicional:
{{
  "qualidade_negocio": {{"score": 8}},
  "saude_financeira": {{"score": 6}},
  "crescimento": {{"score": 7}},
  "valuation": {{"score": 5}},
  "momentum_mercado": {{"score": 7}},
  "comportamento_preco": {{"score": 6}}
}}

Compare os indicadores com benchmarks típicos do setor {sector_str} e com padrões históricos de empresas saudáveis.

Dados da empresa:
{metrics_json}"""
    
    try:
        
        loop = asyncio.get_event_loop()

        def call_claude():
            response = client.messages.create(
                model=MODEL,
                max_tokens=2048,
                messages=[{"role": "user", "content": prompt}]
            )
            return response.content[0].text

        raw = await loop.run_in_executor(None, call_claude)

        # Remove markdown code blocks se existirem
        clean = re.sub(r'```(?:json)?\s*', '', raw).strip()
        clean = re.sub(r'```\s*$', '', clean).strip()

        match = re.search(r'\{[\s\S]*\}', clean)
        if match:
            return json.loads(match.group())
    except Exception as e:
        print("Erro ao gerar pontuações:", str(e))

    return None


async def _noop() -> None:
    return None


async def run_claude_analysis(
    metrics: Dict[str, Any],
    sector: Optional[str],
    sec_text: Optional[str],
) -> Dict[str, Any]:
    scores_task = generate_scores(metrics, sector)
    returns = await asyncio.gather(
        scores_task,
        return_exceptions=True,
    )
    # earnings_task = generate_earnings_summary(sec_text) if sec_text else _noop()
    results = await asyncio.gather(
        generate_scores(metrics, sector),
       # earnings_task,
        return_exceptions=True,
    )

    scores_raw = results[0] if not isinstance(results[0], Exception) else None
#    earnings_raw = results[1] if not isinstance(results[1], Exception) else None

    return {"scores": scores_raw, "earnings": None}
