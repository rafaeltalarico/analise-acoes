export interface PriceData {
  current: number | null;
  change: number | null;
  change_pct: number | null;
  prev_close: number | null;
  day_high: number | null;
  day_low: number | null;
  week52_high: number | null;
  week52_low: number | null;
  market_cap: string | null;
  avg_volume: string | null;
  beta: number | null;
}

export interface ScoreDetail {
  score: number;
  justificativa: string;
  detalhes: Record<string, string>;
}

export interface Scores {
  financial_strength: ScoreDetail | null;
  profitability: ScoreDetail | null;
  growth: ScoreDetail | null;
  valuation: ScoreDetail | null;
  momentum: ScoreDetail | null;
}

export interface ValuationMetrics {
  pe_trailing: number | null;
  pe_forward: number | null;
  price_to_book: number | null;
  price_to_sales: number | null;
  ev_to_ebitda: number | null;
  peg_ratio: number | null;
}

export interface ProfitabilityMetrics {
  net_margin: number | null;
  operating_margin: number | null;
  fcf_margin: number | null;
  ocf_margin: number | null;
  roe: number | null;
  roa: number | null;
}

export interface FinancialStrengthMetrics {
  total_cash: number | null;
  total_debt: number | null;
  cash_to_debt: number | null;
  debt_to_equity: number | null;
  current_ratio: number | null;
  quick_ratio: number | null;
  piotroski_score: number | null;
}

export interface GrowthMetrics {
  revenue_growth_yoy: number | null;
  earnings_growth_yoy: number | null;
  revenue_growth_3y: number | null;
  eps_growth_3y: number | null;
  eps_estimate_next_year: number | null;
  revenue_estimate_next_year: number | null;
}

export interface Metrics {
  valuation: ValuationMetrics;
  profitability: ProfitabilityMetrics;
  financial_strength: FinancialStrengthMetrics;
  growth: GrowthMetrics;
}

export interface PriceTarget {
  current: number | null;
  mean: number | null;
  low: number | null;
  high: number | null;
}

export interface Recommendations {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}

export interface RecentAction {
  firm: string;
  action: string;
  from_grade: string | null;
  to_grade: string | null;
  date: string | null;
}

export interface EarningsEstimate {
  estimate: number | null;
  period: string | null;
}

export interface EarningsEstimates {
  current_quarter: EarningsEstimate | null;
  next_year: EarningsEstimate | null;
}

export interface Analysts {
  price_target: PriceTarget;
  recommendations: Recommendations;
  recent_actions: RecentAction[];
  earnings_estimates: EarningsEstimates;
}

export interface EarningsSummary {
  available: boolean;
  filing_date: string | null;
  period: string | null;
  sentiment: 'POSITIVO' | 'NEUTRO' | 'NEGATIVO' | null;
  text: string | null;
  highlights: string[];
  outlook: string | null;
}

export interface PeerData {
  ticker: string;
  company_name: string | null;
  price: number | null;
  change_pct: number | null;
  pe_forward: number | null;
  pe_trailing: number | null;
  price_to_book: number | null;
  market_cap: string | null;
  net_margin: number | null;
  roe: number | null;
  earnings_growth: number | null;
  revenue_growth: number | null;
  dividend_yield: number | null;
  beta: number | null;
}

export interface StockAnalysis {
  ticker: string;
  company_name: string | null;
  sector: string | null;
  industry: string | null;
  price: PriceData;
  scores: Scores | null;
  metrics: Metrics;
  analysts: Analysts;
  earnings_summary: EarningsSummary;
  peers: PeerData[];
  sources: string[];
  timestamp: string;
  history: HistoryPoint[];
}

export interface HistoryPoint {
  date: string;
  close: number;
  volume: number;
}


export type LoadingStep = 1 | 2 | 3 | 4 | 5;
