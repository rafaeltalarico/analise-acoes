import math
from typing import Optional, Dict, Any, List

import yfinance as yf
import pandas as pd


# ---------------------------------------------------------------------------
# Benchmarks (aproximações de mercado — refinar com dados reais posteriormente)
# ---------------------------------------------------------------------------
RISK_FREE_RATE = 0.043
EQUITY_RISK_PREMIUM = 0.055
TERMINAL_GROWTH_RATE = 0.025
SIGNIFICANT_DISCOUNT_THRESHOLD = 0.20  # 20% abaixo do fair value = "significativamente"

MARKET_AVG_EARNINGS_GROWTH = 0.15
MARKET_AVG_REVENUE_GROWTH = 0.10
HIGH_GROWTH_THRESHOLD = 0.20
FUTURE_ROE_THRESHOLD = 0.20

HIGH_ROE_THRESHOLD = 0.20

DEBT_EQUITY_SATISFACTORY = 1.0
DEBT_COVERAGE_MIN = 0.20
INTEREST_COVERAGE_MIN = 5.0

NOTABLE_DIVIDEND_YIELD_MIN = 0.010
HIGH_DIVIDEND_YIELD_MIN = 0.04
PAYOUT_RATIO_MAX = 0.75

# CEO comp esperado por faixa de market cap
COMP_BENCHMARK_TIERS = [
    (1_000e9, 18_000_000),
    (200e9, 12_000_000),
    (50e9, 8_000_000),
    (10e9, 5_000_000),
    (2e9, 3_000_000),
    (0, 1_500_000),
]
COMP_TOLERANCE = 1.30
COMP_VS_EARNINGS_MAX = 0.01


def safe_float(value, multiplier: float = 1.0) -> Optional[float]:
    try:
        if value is None or (isinstance(value, float) and math.isnan(value)):
            return None
        return round(float(value) * multiplier, 6)
    except (TypeError, ValueError):
        return None


def get_row(df: pd.DataFrame, names: List[str], col_idx: int = 0) -> Optional[float]:
    if df is None or df.empty:
        return None
    for name in names:
        if name in df.index:
            try:
                val = df.loc[name].iloc[col_idx]
                if pd.notna(val):
                    return float(val)
            except (IndexError, TypeError):
                continue
    return None


def check(key: str, label: str, passed: Optional[bool], detail: str) -> Dict[str, Any]:
    return {"key": key, "label": label, "passed": passed, "detail": detail}


def build_group(checks: List[Dict[str, Any]]) -> Dict[str, Any]:
    evaluated = [c for c in checks if c["passed"] is not None]
    passed_count = sum(1 for c in evaluated if c["passed"])
    return {
        "score": passed_count,
        "max": len(checks),
        "evaluated": len(evaluated),
        "checks": checks,
    }


# ---------------------------------------------------------------------------
# DCF simplificado (2 estágios, CAPM)
# ---------------------------------------------------------------------------
def calculate_dcf_fair_value(
    free_cash_flow: Optional[float],
    shares_outstanding: Optional[float],
    beta: Optional[float],
    growth_estimate: Optional[float],
) -> Optional[float]:
    if not free_cash_flow or free_cash_flow <= 0 or not shares_outstanding or shares_outstanding <= 0:
        return None

    b = beta if beta and beta > 0 else 1.0
    discount_rate = RISK_FREE_RATE + b * EQUITY_RISK_PREMIUM
    discount_rate = max(0.06, min(discount_rate, 0.20))

    stage1_growth = growth_estimate if growth_estimate is not None else 0.10
    stage1_growth = max(0.02, min(stage1_growth, 0.40))

    if discount_rate <= TERMINAL_GROWTH_RATE:
        return None

    years = 10
    fcf = free_cash_flow
    pv_sum = 0.0
    for year in range(1, years + 1):
        taper = stage1_growth + (TERMINAL_GROWTH_RATE - stage1_growth) * (year - 1) / (years - 1)
        fcf = fcf * (1 + taper)
        pv_sum += fcf / ((1 + discount_rate) ** year)

    terminal_value = fcf * (1 + TERMINAL_GROWTH_RATE) / (discount_rate - TERMINAL_GROWTH_RATE)
    pv_terminal = terminal_value / ((1 + discount_rate) ** years)

    total_equity_value = pv_sum + pv_terminal
    return total_equity_value / shares_outstanding


def compute_value_checks(
    info: Dict[str, Any],
    peers: List[Dict[str, Any]],
    forward_earnings_growth: Optional[float],
) -> Dict[str, Any]:
    price = safe_float(info.get("currentPrice") or info.get("regularMarketPrice"))
    pe_trailing = safe_float(info.get("trailingPE"))
    pe_forward = safe_float(info.get("forwardPE"))
    peg = safe_float(info.get("pegRatio"))
    target_mean = safe_float(info.get("targetMeanPrice"))

    fair_value = calculate_dcf_fair_value(
        free_cash_flow=info.get("freeCashflow"),
        shares_outstanding=info.get("sharesOutstanding"),
        beta=info.get("beta"),
        growth_estimate=forward_earnings_growth,
    )

    if fair_value is not None:
        total_cash = safe_float(info.get("totalCash")) or 0
        total_debt = safe_float(info.get("totalDebt")) or 0
        shares_out = safe_float(info.get("sharesOutstanding")) or 1
        net_cash_per_share = max(0.0, (total_cash - total_debt) / shares_out)
        fair_value = fair_value + net_cash_per_share

    below_fcf = None
    significantly_below = None
    discount_pct = None
    if fair_value and price:
        discount_pct = (fair_value - price) / fair_value
        below_fcf = discount_pct > 0
        significantly_below = below_fcf and discount_pct >= SIGNIFICANT_DISCOUNT_THRESHOLD

    peer_pes = [p.get("pe_trailing") for p in peers if p.get("pe_trailing")]
    peer_avg_pe = sum(peer_pes) / len(peer_pes) if len(peer_pes) >= 2 else None

    pe_vs_peers = None
    if pe_trailing and peer_avg_pe:
        pe_vs_peers = pe_trailing < peer_avg_pe

    pe_vs_industry = None
    if pe_trailing and peer_avg_pe:
        pe_vs_industry = pe_trailing < peer_avg_pe

    pe_vs_fair_ratio = None
    if peg is not None:
        pe_vs_fair_ratio = peg < 2.0

    analyst_forecast = None
    if target_mean and price:
        analyst_forecast = target_mean > price

    below_fcf_detail = "Dados insuficientes para o DCF"
    significantly_below_detail = "Dados insuficientes para o DCF"
    if fair_value and price and discount_pct is not None:
        if discount_pct >= 0:
            below_fcf_detail = (
                f"Preço ${price:.2f} está {discount_pct*100:.1f}% abaixo do valor justo "
                f"estimado ${fair_value:.2f} (DCF 10 anos + caixa líquido)"
            )
            significantly_below_detail = f"Desconto de {discount_pct*100:.1f}% vs limiar de {SIGNIFICANT_DISCOUNT_THRESHOLD*100:.0f}%"
        else:
            premium_pct = -discount_pct
            large_premium_note = " — modelo DCF tende a subestimar empresas de alto crescimento" if premium_pct > 0.5 else ""
            below_fcf_detail = (
                f"Preço ${price:.2f} está {premium_pct*100:.1f}% acima do valor justo "
                f"estimado ${fair_value:.2f} (DCF 10 anos + caixa líquido){large_premium_note}"
            )
            significantly_below_detail = "Ativo negociado com prêmio sobre o valor justo estimado pelo DCF"

    checks = [
        check(
            "below_fcf_value",
            "Abaixo do Valor de Fluxo de Caixa Futuro",
            below_fcf,
            below_fcf_detail,
        ),
        check(
            "significantly_below_fcf_value",
            "Significativamente Abaixo do Valor de Fluxo de Caixa Futuro",
            significantly_below,
            significantly_below_detail,
        ),
        check(
            "pe_vs_peers",
            "P/E vs Pares",
            pe_vs_peers,
            f"P/E {pe_trailing:.1f}x vs média dos pares {peer_avg_pe:.1f}x" if pe_trailing and peer_avg_pe else "Sem pares disponíveis para comparação",
        ),
        check(
            "pe_vs_industry",
            "P/E vs Indústria",
            pe_vs_industry,
            f"P/E {pe_trailing:.1f}x vs aproximação da indústria {peer_avg_pe:.1f}x" if pe_trailing and peer_avg_pe else "Sem dados de indústria disponíveis",
        ),
        check(
            "pe_vs_fair_ratio",
            "P/E vs Fair Ratio",
            pe_vs_fair_ratio,
            f"PEG de {peg:.2f} ({'abaixo' if pe_vs_fair_ratio else 'acima'} de 2,0)" if peg is not None else "PEG não disponível",
        ),
        check(
            "analyst_forecast",
            "Previsão dos Analistas",
            analyst_forecast,
            f"Alvo médio ${target_mean:.2f} vs preço atual ${price:.2f}" if target_mean and price else "Alvo médio não disponível",
        ),
    ]
    return build_group(checks)


def compute_future_checks(
    info: Dict[str, Any],
    forward_earnings_growth: Optional[float],
    forward_revenue_growth: Optional[float],
) -> Dict[str, Any]:
    roe = safe_float(info.get("returnOnEquity"))

    earnings_vs_savings = None
    earnings_vs_market = None
    high_growth_earnings = None
    if forward_earnings_growth is not None:
        earnings_vs_savings = forward_earnings_growth > RISK_FREE_RATE
        earnings_vs_market = forward_earnings_growth > MARKET_AVG_EARNINGS_GROWTH
        high_growth_earnings = forward_earnings_growth > HIGH_GROWTH_THRESHOLD

    revenue_vs_market = None
    high_growth_revenue = None
    if forward_revenue_growth is not None:
        revenue_vs_market = forward_revenue_growth > MARKET_AVG_REVENUE_GROWTH
        high_growth_revenue = forward_revenue_growth > HIGH_GROWTH_THRESHOLD

    future_roe = roe is not None and roe > FUTURE_ROE_THRESHOLD

    checks = [
        check(
            "earnings_vs_savings_rate",
            "Lucro vs Taxa Livre de Risco",
            earnings_vs_savings,
            f"Crescimento previsto {forward_earnings_growth*100:.1f}% vs taxa livre de risco {RISK_FREE_RATE*100:.1f}%" if forward_earnings_growth is not None else "Estimativa de crescimento de lucro não disponível",
        ),
        check(
            "earnings_vs_market",
            "Lucro vs Mercado",
            earnings_vs_market,
            f"Crescimento previsto {forward_earnings_growth*100:.1f}% vs média do mercado {MARKET_AVG_EARNINGS_GROWTH*100:.0f}%" if forward_earnings_growth is not None else "Estimativa de crescimento de lucro não disponível",
        ),
        check(
            "high_growth_earnings",
            "Alto Crescimento de Lucro",
            high_growth_earnings,
            f"Crescimento previsto {forward_earnings_growth*100:.1f}% vs limiar de {HIGH_GROWTH_THRESHOLD*100:.0f}%" if forward_earnings_growth is not None else "Estimativa de crescimento de lucro não disponível",
        ),
        check(
            "revenue_vs_market",
            "Receita vs Mercado",
            revenue_vs_market,
            f"Crescimento previsto {forward_revenue_growth*100:.1f}% vs média do mercado {MARKET_AVG_REVENUE_GROWTH*100:.0f}%" if forward_revenue_growth is not None else "Estimativa de crescimento de receita não disponível",
        ),
        check(
            "high_growth_revenue",
            "Alto Crescimento de Receita",
            high_growth_revenue,
            f"Crescimento previsto {forward_revenue_growth*100:.1f}% vs limiar de {HIGH_GROWTH_THRESHOLD*100:.0f}%" if forward_revenue_growth is not None else "Estimativa de crescimento de receita não disponível",
        ),
        check(
            "future_roe",
            "ROE Futuro",
            future_roe if roe is not None else None,
            f"ROE atual {roe*100:.1f}% vs limiar de {FUTURE_ROE_THRESHOLD*100:.0f}%" if roe is not None else "ROE não disponível",
        ),
    ]
    return build_group(checks)


def compute_past_checks(
    info: Dict[str, Any],
    income_stmt: pd.DataFrame,
    peers: List[Dict[str, Any]],
) -> Dict[str, Any]:
    net_income_curr = get_row(income_stmt, ["Net Income", "NetIncome", "Net Income Common Stockholders"], 0)
    net_income_prev = get_row(income_stmt, ["Net Income", "NetIncome", "Net Income Common Stockholders"], 1)
    revenue_curr = get_row(income_stmt, ["Total Revenue", "Revenue", "TotalRevenue"], 0)
    revenue_prev = get_row(income_stmt, ["Total Revenue", "Revenue", "TotalRevenue"], 1)

    operating_cash_flow = safe_float(info.get("operatingCashflow"))

    quality_earnings = None
    if operating_cash_flow is not None and net_income_curr:
        quality_earnings = operating_cash_flow > net_income_curr

    margin_curr = (net_income_curr / revenue_curr) if net_income_curr and revenue_curr else None
    margin_prev = (net_income_prev / revenue_prev) if net_income_prev and revenue_prev else None
    growing_margin = None
    if margin_curr is not None and margin_prev is not None:
        growing_margin = margin_curr > margin_prev

    n_years = min(income_stmt.shape[1], 5) if income_stmt is not None and not income_stmt.empty else 0
    yearly_net_income = []
    for i in range(n_years):
        v = get_row(income_stmt, ["Net Income", "NetIncome", "Net Income Common Stockholders"], i)
        if v is not None:
            yearly_net_income.append(v)

    earnings_trend = None
    if len(yearly_net_income) >= 2:
        earnings_trend = yearly_net_income[0] > yearly_net_income[-1]

    growth_1y = None
    if net_income_curr and net_income_prev and net_income_prev != 0:
        growth_1y = (net_income_curr / net_income_prev) - 1

    growth_5y_avg = None
    if len(yearly_net_income) >= 2:
        n = len(yearly_net_income) - 1
        oldest = yearly_net_income[-1]
        newest = yearly_net_income[0]
        if oldest and oldest > 0:
            growth_5y_avg = (newest / oldest) ** (1 / n) - 1

    accelerating_growth = None
    if growth_1y is not None and growth_5y_avg is not None:
        accelerating_growth = growth_1y > growth_5y_avg

    peer_growths = [p.get("earnings_growth") for p in peers if p.get("earnings_growth") is not None]
    peer_avg_growth = (sum(peer_growths) / len(peer_growths) / 100) if peer_growths else None
    earnings_vs_industry = None
    if growth_1y is not None and peer_avg_growth is not None:
        earnings_vs_industry = growth_1y > peer_avg_growth

    roe = safe_float(info.get("returnOnEquity"))
    high_roe = roe is not None and roe > HIGH_ROE_THRESHOLD

    checks = [
        check(
            "quality_earnings",
            "Qualidade do Lucro",
            quality_earnings,
            f"Fluxo de caixa operacional ${operating_cash_flow:,.0f} vs lucro líquido ${net_income_curr:,.0f}" if operating_cash_flow is not None and net_income_curr else "Dados de fluxo de caixa insuficientes",
        ),
        check(
            "growing_profit_margin",
            "Margem de Lucro Crescente",
            growing_margin,
            f"Margem atual {margin_curr*100:.1f}% vs ano anterior {margin_prev*100:.1f}%" if margin_curr is not None and margin_prev is not None else "Histórico de margem insuficiente",
        ),
        check(
            "earnings_trend",
            "Tendência de Lucro",
            earnings_trend,
            f"Lucro do período mais recente vs mais antigo disponível ({len(yearly_net_income)} anos)" if earnings_trend is not None else "Histórico de lucro insuficiente",
        ),
        check(
            "accelerating_growth",
            "Crescimento Acelerando",
            accelerating_growth,
            f"Crescimento do último ano {growth_1y*100:.1f}% vs média de {len(yearly_net_income)} anos {growth_5y_avg*100:.1f}%" if growth_1y is not None and growth_5y_avg is not None else "Histórico insuficiente para calcular aceleração",
        ),
        check(
            "earnings_vs_industry",
            "Lucro vs Indústria",
            earnings_vs_industry,
            f"Crescimento {growth_1y*100:.1f}% vs média dos pares {peer_avg_growth*100:.1f}%" if growth_1y is not None and peer_avg_growth is not None else "Sem pares disponíveis para comparação",
        ),
        check(
            "high_roe",
            "ROE Elevado",
            high_roe if roe is not None else None,
            f"ROE {roe*100:.1f}% vs limiar de {HIGH_ROE_THRESHOLD*100:.0f}%" if roe is not None else "ROE não disponível",
        ),
    ]
    return build_group(checks)


def compute_health_checks(info: Dict[str, Any], balance_sheet: pd.DataFrame, income_stmt: pd.DataFrame) -> Dict[str, Any]:
    current_ratio = safe_float(info.get("currentRatio"))
    total_debt = safe_float(info.get("totalDebt"))
    total_cash = safe_float(info.get("totalCash"))
    debt_to_equity = safe_float(info.get("debtToEquity"))
    operating_cash_flow = safe_float(info.get("operatingCashflow"))
    ebit = get_row(income_stmt, ["EBIT", "Operating Income", "OperatingIncome"], 0)

    current_assets = get_row(balance_sheet, ["Current Assets", "TotalCurrentAssets"], 0)
    current_liab = get_row(balance_sheet, ["Current Liabilities", "TotalCurrentLiabilities"], 0)
    total_liab = get_row(balance_sheet, ["Total Liabilities Net Minority Interest", "TotalLiab"], 0)
    total_assets = get_row(balance_sheet, ["Total Assets", "TotalAssets"], 0)

    sector = info.get("sector", "")
    is_financial = sector in ("Financial Services", "Financial")

    short_term_liabilities = None
    if is_financial:
        if total_assets is not None and total_liab is not None:
            short_term_liabilities = total_assets > total_liab
    elif current_ratio is not None:
        short_term_liabilities = current_ratio > 1.0
    elif current_assets is not None and current_liab is not None:
        short_term_liabilities = current_assets > current_liab

    long_term_liabilities = None
    if is_financial:
        if total_assets is not None and total_liab is not None:
            long_term_liabilities = total_assets > total_liab
    elif current_assets is not None and current_liab is not None and total_liab is not None:
        non_current_liab = total_liab - current_liab
        working_capital = current_assets - current_liab
        long_term_liabilities = working_capital > non_current_liab or non_current_liab <= 0

    debt_level = None
    if is_financial:
        if total_assets is not None and total_liab is not None:
            debt_level = total_assets > total_liab
    elif debt_to_equity is not None:
        de_ratio = debt_to_equity / 100 if debt_to_equity > 5 else debt_to_equity
        debt_level = de_ratio < DEBT_EQUITY_SATISFACTORY
    if debt_level is None and total_cash is not None and total_debt is not None:
        debt_level = total_cash >= total_debt

    reducing_debt = None
    de_curr = get_row(balance_sheet, ["Long Term Debt", "LongTermDebt"], 0)
    de_prev = get_row(balance_sheet, ["Long Term Debt", "LongTermDebt"], min(4, balance_sheet.shape[1] - 1) if balance_sheet is not None and not balance_sheet.empty else 0)
    if de_curr is not None and de_prev is not None:
        reducing_debt = de_curr <= de_prev
    elif total_debt is not None and total_debt == 0:
        reducing_debt = True

    debt_coverage = None
    if operating_cash_flow is not None and total_debt is not None:
        if total_debt == 0:
            debt_coverage = True
        else:
            debt_coverage = (operating_cash_flow / total_debt) > DEBT_COVERAGE_MIN

    interest_expense = get_row(income_stmt, ["Interest Expense", "InterestExpense", "Interest Expense Non Operating"], 0)
    interest_coverage = None
    if interest_expense is not None and interest_expense != 0 and ebit is not None:
        interest_coverage = (ebit / abs(interest_expense)) > INTEREST_COVERAGE_MIN
    elif not interest_expense:
        interest_coverage = True

    checks = [
        check(
            "short_term_liabilities",
            "Passivos de Curto Prazo",
            short_term_liabilities,
            f"Current ratio {current_ratio:.2f}" if current_ratio is not None else "Current ratio não disponível",
        ),
        check(
            "long_term_liabilities",
            "Passivos de Longo Prazo",
            long_term_liabilities,
            "Ativos de curto prazo cobrem os passivos de longo prazo" if long_term_liabilities else "Dados de balanço insuficientes",
        ),
        check(
            "debt_level",
            "Nível de Dívida",
            debt_level,
            f"Debt/Equity {debt_to_equity:.2f}" if debt_to_equity is not None else "Debt/Equity não disponível",
        ),
        check(
            "reducing_debt",
            "Reduzindo Dívida",
            reducing_debt,
            "Alavancagem estável ou em queda" if reducing_debt else "Histórico de dívida insuficiente",
        ),
        check(
            "debt_coverage",
            "Cobertura de Dívida",
            debt_coverage,
            f"OCF ${operating_cash_flow:,.0f} vs dívida total ${total_debt:,.0f}" if operating_cash_flow is not None and total_debt is not None else "Dados de fluxo de caixa insuficientes",
        ),
        check(
            "interest_coverage",
            "Cobertura de Juros",
            interest_coverage,
            f"EBIT cobre despesa de juros em {(ebit/abs(interest_expense)):.1f}x" if interest_expense and ebit else "Sem dívida com juros relevante ou dado indisponível",
        ),
    ]
    return build_group(checks)


def compute_dividend_checks(info: Dict[str, Any], dividends: pd.Series) -> Dict[str, Any]:
    dividend_yield = safe_float(info.get("dividendYield"))
    if dividend_yield and dividend_yield > 1:
        dividend_yield = dividend_yield / 100

    dividend_rate = safe_float(info.get("dividendRate"))
    price_for_yield = safe_float(info.get("currentPrice") or info.get("regularMarketPrice"))
    if dividend_yield and dividend_rate and price_for_yield and price_for_yield > 0:
        calculated_yield = dividend_rate / price_for_yield
        if calculated_yield > 0 and dividend_yield / calculated_yield > 10:
            dividend_yield = calculated_yield

    notable_dividend = dividend_yield is not None and dividend_yield >= NOTABLE_DIVIDEND_YIELD_MIN

    if not notable_dividend:
        not_notable_detail = "Dividendo não é considerado notável para o mercado americano"
        checks = [
            check("notable_dividend", "Dividendo Notável", False, f"Yield de {dividend_yield*100:.2f}% abaixo do piso de {NOTABLE_DIVIDEND_YIELD_MIN*100:.1f}%" if dividend_yield is not None else "Empresa não paga dividendos"),
            check("high_dividend", "Alto Dividendo", False, not_notable_detail),
            check("stable_dividend", "Dividendo Estável", False, not_notable_detail),
            check("growing_dividend", "Dividendo Crescente", False, not_notable_detail),
            check("earnings_coverage", "Cobertura por Lucro", False, not_notable_detail),
            check("cash_flow_coverage", "Cobertura por Fluxo de Caixa", False, not_notable_detail),
        ]
        return build_group(checks)

    high_dividend = dividend_yield >= HIGH_DIVIDEND_YIELD_MIN

    stable_dividend = None
    growing_dividend = None
    if dividends is not None and not dividends.empty:
        annual = dividends.groupby(dividends.index.year).sum()
        annual = annual.tail(10)
        if len(annual) >= 2:
            values = annual.tolist()
            drops = [values[i] < values[i - 1] * 0.8 for i in range(1, len(values))]
            stable_dividend = not any(drops)
            growing_dividend = values[-1] >= values[0]

    payout_ratio = safe_float(info.get("payoutRatio"))
    earnings_coverage = payout_ratio is not None and payout_ratio < PAYOUT_RATIO_MAX

    free_cash_flow = safe_float(info.get("freeCashflow"))
    dividends_paid = safe_float(info.get("dividendRate"))
    shares_outstanding = safe_float(info.get("sharesOutstanding"))
    cash_flow_coverage = None
    if free_cash_flow and dividends_paid and shares_outstanding:
        total_dividends_paid = dividends_paid * shares_outstanding
        cash_flow_coverage = (total_dividends_paid / free_cash_flow) < PAYOUT_RATIO_MAX

    checks = [
        check(
            "notable_dividend",
            "Dividendo Notável",
            True,
            f"Yield de {dividend_yield*100:.2f}% acima do piso de {NOTABLE_DIVIDEND_YIELD_MIN*100:.1f}%",
        ),
        check(
            "high_dividend",
            "Alto Dividendo",
            high_dividend,
            f"Yield de {dividend_yield*100:.2f}% vs limiar de {HIGH_DIVIDEND_YIELD_MIN*100:.1f}%",
        ),
        check(
            "stable_dividend",
            "Dividendo Estável",
            stable_dividend,
            "Sem cortes superiores a 20% no histórico recente" if stable_dividend else "Histórico de dividendos insuficiente ou com cortes",
        ),
        check(
            "growing_dividend",
            "Dividendo Crescente",
            growing_dividend,
            "Dividendo anual cresceu no período analisado" if growing_dividend else "Histórico de dividendos insuficiente ou decrescente",
        ),
        check(
            "earnings_coverage",
            "Cobertura por Lucro",
            earnings_coverage,
            f"Payout ratio de {payout_ratio*100:.1f}% vs limiar de {PAYOUT_RATIO_MAX*100:.0f}%" if payout_ratio is not None else "Payout ratio não disponível",
        ),
        check(
            "cash_flow_coverage",
            "Cobertura por Fluxo de Caixa",
            cash_flow_coverage,
            "Dividendo coberto pelo fluxo de caixa livre" if cash_flow_coverage else "Dados de fluxo de caixa insuficientes",
        ),
    ]
    return build_group(checks)


def comp_benchmark_for_market_cap(market_cap: Optional[float]) -> Optional[float]:
    if not market_cap:
        return None
    for threshold, benchmark in COMP_BENCHMARK_TIERS:
        if market_cap >= threshold:
            return benchmark
    return COMP_BENCHMARK_TIERS[-1][1]


def compute_management_checks(info: Dict[str, Any]) -> Dict[str, Any]:
    officers = info.get("companyOfficers") or []
    ceo = None
    for officer in officers:
        title = (officer.get("title") or "").lower()
        if "chief executive" in title or title.strip() == "ceo":
            ceo = officer
            break

    ceo_pay = safe_float(ceo.get("totalPay")) if ceo else None
    market_cap = safe_float(info.get("marketCap"))
    benchmark = comp_benchmark_for_market_cap(market_cap)

    compensation_vs_market = None
    if ceo_pay is not None and benchmark is not None:
        compensation_vs_market = ceo_pay <= benchmark * COMP_TOLERANCE

    net_income = safe_float(info.get("netIncomeToCommon"))
    compensation_vs_earnings = None
    if ceo_pay is not None and net_income and net_income > 0:
        compensation_vs_earnings = (ceo_pay / net_income) < COMP_VS_EARNINGS_MAX

    checks = [
        check(
            "compensation_vs_market",
            "Remuneração vs Mercado",
            compensation_vs_market,
            f"Remuneração do CEO ${ceo_pay:,.0f} vs referência de mercado ${benchmark:,.0f}" if ceo_pay is not None and benchmark is not None else "Dados de remuneração do CEO não disponíveis",
        ),
        check(
            "compensation_vs_earnings",
            "Remuneração vs Lucro",
            compensation_vs_earnings,
            f"Remuneração representa {(ceo_pay/net_income)*100:.3f}% do lucro líquido" if ceo_pay is not None and net_income else "Dados insuficientes para comparar remuneração e lucro",
        ),
        check(
            "experienced_management",
            "Experiência da Diretoria",
            None,
            "Dados de tempo de mandato não disponíveis via Yahoo Finance",
        ),
        check(
            "experienced_board",
            "Experiência do Conselho",
            None,
            "Dados de tempo de mandato não disponíveis via Yahoo Finance",
        ),
    ]
    return build_group(checks)


async def get_snowflake_analysis(
    ticker: str,
    peers: List[Dict[str, Any]],
) -> Dict[str, Any]:
    if not peers:
        print(f"Aviso: Nenhum peer encontrado para {ticker}, usando dados isolados")
        try:
            stock = yf.Ticker(ticker)
            info = stock.info
            peers = [{
                "symbol": ticker,
                "pe_trailing": safe_float(info.get("trailingPE")),
                "earnings_growth": safe_float(info.get("earningsGrowth")),
            }]
        except:
            peers = []
    stock = yf.Ticker(ticker)
    info = stock.info

    if not info:
        raise ValueError(f"Ticker '{ticker}' não encontrado ou inválido.")

    try:
        balance_sheet = stock.balance_sheet
    except Exception:
        balance_sheet = pd.DataFrame()

    try:
        income_stmt = stock.income_stmt
    except Exception:
        income_stmt = pd.DataFrame()

    try:
        dividends = stock.dividends
    except Exception:
        dividends = pd.Series(dtype=float)

    forward_earnings_growth = None
    try:
        ee = stock.earnings_estimate
        if ee is not None and not ee.empty and "growth" in ee.columns:
            candidates = []
            for period in ["+1y", "+2y"]:
                if period in ee.index:
                    val = safe_float(ee.loc[period, "growth"])
                    if val is not None and val > 0.01:
                        candidates.append(val)
            if candidates:
                forward_earnings_growth = max(candidates)
    except Exception:
        pass

    trailing_earnings_growth = safe_float(info.get("earningsGrowth"))
    if trailing_earnings_growth and trailing_earnings_growth > 0.02:
        if forward_earnings_growth is None:
            forward_earnings_growth = trailing_earnings_growth
        elif forward_earnings_growth < 0.05:
            forward_earnings_growth = (forward_earnings_growth + trailing_earnings_growth) / 2

    print(f"📈 Forward earnings growth: {forward_earnings_growth}")

    forward_revenue_growth = None
    try:
        re_ = stock.revenue_estimate
        if re_ is not None and not re_.empty and "+1y" in re_.index and "growth" in re_.columns:
            forward_revenue_growth = safe_float(re_.loc["+1y", "growth"])
    except Exception:
        pass

    value = compute_value_checks(info, peers, forward_earnings_growth)
    future = compute_future_checks(info, forward_earnings_growth, forward_revenue_growth)
    past = compute_past_checks(info, income_stmt, peers)
    health = compute_health_checks(info, balance_sheet, income_stmt)
    dividend = compute_dividend_checks(info, dividends)
    management = compute_management_checks(info)

    return {
        "value": value,
        "future": future,
        "past": past,
        "health": health,
        "dividend": dividend,
        "management": management,
    }


async def get_peers(ticker: str) -> List[Dict[str, Any]]:
    try:
        stock = yf.Ticker(ticker)
        info = stock.info

        sector = info.get("sector")
        if not sector:
            return []

        print(f"Buscando peers para {ticker} no setor: {sector}")
        peers = get_fallback_peers(sector)

        enriched_peers = []
        for sym in peers[:10]:
            try:
                peer = yf.Ticker(sym)
                peer_info = peer.info
                peer_data = {
                    "symbol": sym,
                    "pe_trailing": safe_float(peer_info.get("trailingPE")),
                    "earnings_growth": safe_float(peer_info.get("earningsGrowth")),
                    "market_cap": safe_float(peer_info.get("marketCap")),
                    "pe_forward": safe_float(peer_info.get("forwardPE")),
                }
                peer_data = {k: v for k, v in peer_data.items() if v is not None}
                if peer_data:
                    enriched_peers.append(peer_data)
            except Exception as e:
                print(f"Erro ao buscar dados de {sym}: {e}")
                continue

        print(f"Encontrados {len(enriched_peers)} peers para {ticker}")
        return enriched_peers

    except Exception as e:
        print(f"Erro ao buscar peers para {ticker}: {e}")
        return []


def get_fallback_peers(sector: str) -> List[str]:
    # 15 candidates per sector so the endpoint can rank by market cap and return top 10
    sector_peers = {
        "Technology": [
            "AAPL", "MSFT", "NVDA", "AVGO", "ORCL", "AMD", "ADBE", "CRM", "QCOM", "TXN",
            "INTC", "NOW", "IBM", "AMAT", "MU",
        ],
        "Healthcare": [
            "LLY", "UNH", "JNJ", "ABBV", "MRK", "TMO", "ABT", "AMGN", "PFE", "DHR",
            "ISRG", "BMY", "GILD", "CVS", "MDT",
        ],
        "Financial Services": [
            "BRK-B", "JPM", "V", "MA", "BAC", "WFC", "GS", "MS", "SPGI", "AXP",
            "BLK", "C", "CB", "CME", "PGR",
        ],
        "Consumer Cyclical": [
            "AMZN", "TSLA", "HD", "MCD", "BKNG", "NKE", "TJX", "LOW", "SBUX", "CMG",
            "ABNB", "MAR", "GM", "TGT", "F",
        ],
        "Consumer Defensive": [
            "WMT", "PG", "KO", "COST", "PEP", "PM", "MO", "MDLZ", "CL", "KHC",
            "GIS", "SYY", "STZ", "KMB", "CHD",
        ],
        "Communication Services": [
            "GOOGL", "META", "NFLX", "DIS", "CMCSA", "TMUS", "VZ", "T", "CHTR", "EA",
            "WBD", "SNAP", "MTCH", "IPG", "OMC",
        ],
        "Industrials": [
            "GE", "RTX", "CAT", "HON", "UNP", "UPS", "BA", "DE", "LMT", "ETN",
            "WM", "ITW", "EMR", "PH", "TT",
        ],
        "Energy": [
            "XOM", "CVX", "COP", "EOG", "SLB", "PSX", "MPC", "OXY", "VLO", "WMB",
            "KMI", "HAL", "BKR", "DVN", "FANG",
        ],
        "Basic Materials": [
            "LIN", "SHW", "APD", "ECL", "FCX", "NEM", "DOW", "DD", "NUE", "ALB",
            "CF", "MOS", "WLK", "EMN", "CTVA",
        ],
        "Real Estate": [
            "PLD", "AMT", "EQIX", "WELL", "CCI", "PSA", "SPG", "O", "DLR", "AVB",
            "VICI", "IRM", "EQR", "ARE", "EXR",
        ],
        "Utilities": [
            "NEE", "SO", "DUK", "D", "SRE", "AEP", "EXC", "XEL", "ED", "WEC",
            "ES", "ETR", "FE", "EIX", "PPL",
        ],
    }
    # Aliases for backward-compat
    sector_peers["Financial"] = sector_peers["Financial Services"]
    sector_peers["Industrial"] = sector_peers["Industrials"]
    sector_peers["Communication"] = sector_peers["Communication Services"]
    sector_peers["Consumer Staples"] = sector_peers["Consumer Defensive"]
    sector_peers["Materials"] = sector_peers["Basic Materials"]

    return sector_peers.get(sector, sector_peers.get("Technology", ["AAPL", "MSFT", "GOOGL"]))
