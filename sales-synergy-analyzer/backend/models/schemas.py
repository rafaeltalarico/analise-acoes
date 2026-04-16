from pydantic import BaseModel
from typing import Optional, List, Dict, Any


class PriceData(BaseModel):
    current: Optional[float] = None
    change: Optional[float] = None
    change_pct: Optional[float] = None
    prev_close: Optional[float] = None
    day_high: Optional[float] = None
    day_low: Optional[float] = None
    week52_high: Optional[float] = None
    week52_low: Optional[float] = None
    market_cap: Optional[str] = None
    avg_volume: Optional[str] = None
    beta: Optional[float] = None


class ScoreDetail(BaseModel):
    score: int
    justificativa: str
    detalhes: Dict[str, str] = {}


class Scores(BaseModel):
    financial_strength: Optional[ScoreDetail] = None
    profitability: Optional[ScoreDetail] = None
    growth: Optional[ScoreDetail] = None
    valuation: Optional[ScoreDetail] = None
    momentum: Optional[ScoreDetail] = None


class ValuationMetrics(BaseModel):
    pe_trailing: Optional[float] = None
    pe_forward: Optional[float] = None
    price_to_book: Optional[float] = None
    price_to_sales: Optional[float] = None
    ev_to_ebitda: Optional[float] = None
    peg_ratio: Optional[float] = None


class ProfitabilityMetrics(BaseModel):
    net_margin: Optional[float] = None
    operating_margin: Optional[float] = None
    fcf_margin: Optional[float] = None
    ocf_margin: Optional[float] = None
    roe: Optional[float] = None
    roa: Optional[float] = None


class FinancialStrengthMetrics(BaseModel):
    total_cash: Optional[float] = None
    total_debt: Optional[float] = None
    cash_to_debt: Optional[float] = None
    debt_to_equity: Optional[float] = None
    current_ratio: Optional[float] = None
    quick_ratio: Optional[float] = None
    piotroski_score: Optional[int] = None


class GrowthMetrics(BaseModel):
    revenue_growth_yoy: Optional[float] = None
    earnings_growth_yoy: Optional[float] = None
    revenue_growth_3y: Optional[float] = None
    eps_growth_3y: Optional[float] = None
    eps_estimate_next_year: Optional[float] = None
    revenue_estimate_next_year: Optional[float] = None


class Metrics(BaseModel):
    valuation: ValuationMetrics = ValuationMetrics()
    profitability: ProfitabilityMetrics = ProfitabilityMetrics()
    financial_strength: FinancialStrengthMetrics = FinancialStrengthMetrics()
    growth: GrowthMetrics = GrowthMetrics()


class PriceTarget(BaseModel):
    current: Optional[float] = None
    mean: Optional[float] = None
    low: Optional[float] = None
    high: Optional[float] = None


class Recommendations(BaseModel):
    strongBuy: int = 0
    buy: int = 0
    hold: int = 0
    sell: int = 0
    strongSell: int = 0


class RecentAction(BaseModel):
    firm: str
    action: str
    from_grade: Optional[str] = None
    to_grade: Optional[str] = None
    date: Optional[str] = None


class EarningsEstimate(BaseModel):
    estimate: Optional[float] = None
    period: Optional[str] = None


class EarningsEstimates(BaseModel):
    current_quarter: Optional[EarningsEstimate] = None
    next_year: Optional[EarningsEstimate] = None


class Analysts(BaseModel):
    price_target: PriceTarget = PriceTarget()
    recommendations: Recommendations = Recommendations()
    recent_actions: List[RecentAction] = []
    earnings_estimates: EarningsEstimates = EarningsEstimates()


class EarningsSummary(BaseModel):
    available: bool = False
    filing_date: Optional[str] = None
    period: Optional[str] = None
    sentiment: Optional[str] = None
    text: Optional[str] = None
    highlights: List[str] = []
    outlook: Optional[str] = None


class PeerData(BaseModel):
    ticker: str
    company_name: Optional[str] = None
    price: Optional[float] = None
    change_pct: Optional[float] = None
    pe_forward: Optional[float] = None
    pe_trailing: Optional[float] = None
    price_to_book: Optional[float] = None
    market_cap: Optional[str] = None
    net_margin: Optional[float] = None
    roe: Optional[float] = None
    earnings_growth: Optional[float] = None
    revenue_growth: Optional[float] = None
    dividend_yield: Optional[float] = None
    beta: Optional[float] = None


class StockAnalysis(BaseModel):
    ticker: str
    company_name: Optional[str] = None
    sector: Optional[str] = None
    industry: Optional[str] = None
    price: PriceData = PriceData()
    scores: Optional[Scores] = None
    metrics: Metrics = Metrics()
    analysts: Analysts = Analysts()
    earnings_summary: EarningsSummary = EarningsSummary()
    peers: List[PeerData] = []
    sources: List[str] = []
    timestamp: Optional[str] = None
