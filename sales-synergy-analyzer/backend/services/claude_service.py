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
retorne "score": null no JSON desse bloco.


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
REGRA DE PONDERAÇÃO OBRIGATÓRIA:
- A posição no range de 52 semanas NÃO deve ser analisada isoladamente.
- Se o retorno em 1 ano for > 50%, uma posição acima de 85% no range indica
  tendência forte em continuidade — não é sinal negativo.
- Penalize posição alta no range APENAS se o retorno for baixo ou negativo,
  indicando que o ativo está próximo da máxima sem momentum que justifique.
- Priorize a consistência: retorno positivo em 3+ dos últimos 5 anos e
  preço acima da MM200 são os dois critérios mais importantes do bloco.
- Score alto (8-10): retorno 3Y > 50%, acima da MM200, 4-5 anos positivos,
  tendência clara independente da posição no range.
- Score médio (5-7): tendência presente mas inconsistente, ou abaixo da MM200.
- Score baixo (1-4): tendência lateral ou de queda, abaixo da MM200,
  ou posição alta no range COM retorno fraco.

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

async def generate_metrics_summary(metrics: Dict[str, Any], sector: Optional[str]) -> Optional[Dict[str, Any]]:
    client = get_client()
    if not client:
        return None

    sector_str = sector or "Technology"
    metrics_json = json.dumps(metrics, indent=2, default=str)

    prompt = f"""Você é um analista financeiro especialista em ações americanas.

Analise os indicadores financeiros fornecidos e gere um resumo em linguagem simples e direta,
voltado para investidores não técnicos que querem entender rapidamente se o ativo é atrativo.

REGRAS OBRIGATÓRIAS:
- Compare SEMPRE com a média típica do setor {sector_str}
- Use linguagem simples, sem jargões técnicos
- Seja direto: diga se é bom, neutro ou ruim e POR QUÊ
- Cite o benchmark do setor na frase quando relevante (ex: "acima da média do setor ~15%")
- Máximo 12 palavras por frase
- status deve ser exatamente: "positivo", "neutro" ou "negativo"
- Retorne EXATAMENTE 4 itens em cada bloco, sempre os mesmos. Nunca omita um item por falta de dados — use "N/D" como value e status "neutro".

BENCHMARKS TÍPICOS POR MÉTRICA (ajuste conforme o setor {sector_str}):
- ROE: positivo >15%, neutro 8-15%, negativo <8%
- ROA: positivo >10%, neutro 5-10%, negativo <5%
- Net Margin: positivo >20%, neutro 10-20%, negativo <10%
- FCF Margin: positivo >15%, neutro 5-15%, negativo <5%
- P/E Forward: depende do setor e crescimento — use PEG como contexto
- P/B: positivo <3x, neutro 3-6x, negativo >6x (exceto financeiras)
- EV/EBITDA: positivo <15x, neutro 15-25x, negativo >25x
- Cash-to-Debt: positivo >1, neutro 0.5-1, negativo <0.5
- Debt/Equity: positivo <1, neutro 1-3, negativo >3
- Current Ratio: positivo >2, neutro 1-2, negativo <1
- Piotroski Score: positivo >=7, neutro 4-6, negativo <4
- Receita YoY: positivo >15%, neutro 5-15%, negativo <5%
- Lucro YoY: positivo >20%, neutro 5-20%, negativo <5%
- Receita 3Y CAGR: positivo >10%, neutro 5-10%, negativo <5%
- EPS Est. Próx. Ano: positivo >10% vs ano atual, neutro 0-10%, negativo <0%
- Consenso Analistas: positivo maioria Buy, neutro maioria Hold, negativo maioria Sell
- Upside implícito: positivo >15%, neutro 5-15%, negativo <5%
- Retorno 1Y: positivo >20%, neutro 5-20%, negativo <5%
- Retorno 3Y: positivo >50%, neutro 15-50%, negativo <15%
- Posição 52W: positivo 40-80% (zona de entrada), neutro 85-95%, negativo >95% ou <20%
- Anos positivos 5a: positivo 4-5, neutro 3, negativo 0-2. Importante: e retorno 1Y > 50%, posição acima de 85% é sinal de força,
  não de risco — ajuste o status para positivo ou neutro conforme o contexto.


Retorne APENAS JSON válido no formato abaixo, sem texto adicional:
{{
  
  "qualidade_negocio": [
    {{"label": "ROE", "value": "34%", "status": "positivo", "frase": "Excepcional — 2x acima da média do setor ~15%"}},
    {{"label": "ROA", "value": "14,8%", "status": "positivo", "frase": "Uso eficiente dos ativos, acima da média ~8%"}},
    {{"label": "Margem Líquida", "value": "39%", "status": "positivo", "frase": "Entre as maiores do setor — forte poder de precificação"}},
    {{"label": "FCF Margin", "value": "13%", "status": "neutro", "frase": "Conversão de caixa livre adequada para o setor"}}
  ],
  "saude_financeira": [
    {{"label": "Cash-to-Debt", "value": "0,62", "status": "negativo", "frase": "Dívida supera o caixa disponível — atenção"}},
    {{"label": "Debt/Equity", "value": "30,3x", "status": "negativo", "frase": "Alavancagem elevada vs média do setor ~8x"}},
    {{"label": "Current Ratio", "value": "1,28", "status": "neutro", "frase": "Liquidez adequada para cobrir obrigações de curto prazo"}},
    {{"label": "Piotroski Score", "value": "6/9", "status": "neutro", "frase": "Saúde financeira moderada — sem sinais críticos"}}
  ],
  "crescimento": [
    {{"label": "Receita YoY", "value": "18,3%", "status": "positivo", "frase": "Crescimento forte, bem acima da média do setor ~6%"}},
    {{"label": "Lucro YoY", "value": "23,4%", "status": "positivo", "frase": "Lucro crescendo mais rápido que a receita — ótimo sinal"}},
    {{"label": "Receita 3Y CAGR", "value": "12,4%", "status": "positivo", "frase": "Crescimento consistente nos últimos 3 anos"}},
    {{"label": "EPS Est. Próx. Ano", "value": "$19,34", "status": "positivo", "frase": "Analistas projetam crescimento de lucro para o próximo ano"}}
  ],
  "preco_valor": [
    {{"label": "P/E Forward", "value": "21,3x", "status": "neutro", "frase": "Múltiplo justo para o crescimento do setor"}},
    {{"label": "P/B", "value": "7,4x", "status": "negativo", "frase": "Acima da média do setor — ativo com prêmio de mercado"}},
    {{"label": "EV/EBITDA", "value": "17,0x", "status": "neutro", "frase": "Valuation moderado vs média do setor ~15x"}},
    {{"label": "P/S (TTM)", "value": "9,6x", "status": "negativo", "frase": "Investidor paga $9,6 por cada $1 de receita"}}
  ],
  "momentum_mercado": [
    {{"label": "Consenso Analistas", "value": "Buy", "status": "positivo", "frase": "Maioria dos analistas recomenda compra"}},
    {{"label": "Price Target Médio", "value": "$250", "status": "positivo", "frase": "Upside implícito de 20% em relação ao preço atual"}},
    {{"label": "Upgrades Recentes", "value": "3 upgrades", "status": "positivo", "frase": "Tendência recente de upgrades por parte dos analistas"}},
    {{"label": "Movimentações Recentes", "value": "3 upgrades", "status": "positivo", "frase": "Revisões recentes favoráveis — analistas mais otimistas"}}
  ],
    "comportamento_preco": [
    {{"label": "Retorno 1 Ano", "value": "35%", "status": "positivo", "frase": "Desempenho forte no último ano"}},
    {{"label": "Posição no Range 52 Semanas", "value": "80%", "status": "neutro", "frase": "Próximo da máxima, mas ainda com espaço para crescimento"}},
    {{"label": "Distância da Máxima Histórica", "value": "20%", "status": "neutro", "frase": "Ativo está 20% abaixo da máxima histórica"}},
    {{"label": "Preço vs Média Móvel 200d", "value": "+10%", "status": "positivo", "frase": "Preço está 10% acima da média móvel de longo prazo"}}  
}}

Dados da empresa (setor: {sector_str}):
{metrics_json}"""

    try:
        loop = asyncio.get_event_loop()

        def call_claude():
            response = client.messages.create(
                model=MODEL,
                max_tokens=2048,
                temperature=0,
                messages=[{"role": "user", "content": prompt}]
            )
            return response.content[0].text

        raw = await loop.run_in_executor(None, call_claude)
        print("=== METRICS SUMMARY RAW ===")
        print(raw)
        print("=== FIM ===")

        clean = re.sub(r'```(?:json)?\s*', '', raw).strip()
        clean = re.sub(r'```\s*$', '', clean).strip()

        match = re.search(r'\{[\s\S]*\}', clean)
        if match:
            return json.loads(match.group())
    except Exception as e:
        print("Erro ao gerar metrics summary:", str(e))

    return None


async def translate_news_items(items: list) -> list:
    """Translates English financial news items to Brazilian Portuguese. Falls back to originals on error."""
    client = get_client()
    if not client or not items:
        return items

    numbered = "\n".join(f"{i + 1}. {item}" for i, item in enumerate(items))
    prompt = (
        "Traduza as notícias financeiras abaixo do inglês para o português brasileiro.\n"
        "Mantenha termos técnicos consagrados (EPS, guidance, rally, selloff, bull, bear) sem traduzir.\n"
        "Retorne APENAS a lista numerada traduzida, sem texto adicional.\n\n"
        f"{numbered}"
    )

    try:
        loop = asyncio.get_event_loop()

        def _call():
            response = client.messages.create(
                model=MODEL,
                max_tokens=2048,
                messages=[{"role": "user", "content": prompt}],
            )
            return response.content[0].text

        raw = await loop.run_in_executor(None, _call)

        translated = []
        for line in raw.strip().split("\n"):
            line = line.strip()
            if not line:
                continue
            m = re.match(r"^\d+[.)]\s*(.+)", line)
            if m:
                translated.append(m.group(1))

        if len(translated) == len(items):
            return translated
    except Exception as e:
        print(f"Erro ao traduzir notícias: {e}")

    return items


async def _noop() -> None:
    return None


async def run_claude_analysis(
    metrics: Dict[str, Any],
    sector: Optional[str],
    sec_text: Optional[str],
) -> Dict[str, Any]:
    print(">>> run_claude_analysis chamada")

    results = await asyncio.gather(
        generate_scores(metrics, sector),
        generate_metrics_summary(metrics, sector),
        return_exceptions=True,
    )

    scores_raw = results[0] if not isinstance(results[0], Exception) else None
    metrics_summary_raw = results[1] if not isinstance(results[1], Exception) else None

    return {
        "scores": scores_raw,
        "earnings": None,
        "metrics_summary": metrics_summary_raw
    }