import yfinance as yf
import pandas as pd
from typing import Optional, Dict, Any
import math


def safe_float(value, multiplier=1.0) -> Optional[float]:
    try:
        if value is None or (isinstance(value, float) and math.isnan(value)):
            return None
        return round(float(value) * multiplier, 4)
    except (TypeError, ValueError):
        return None


def format_large_number(value) -> Optional[str]:
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


def get_income_stmt_value(income_stmt: pd.DataFrame, row_names: list, col_idx: int = 0) -> Optional[float]:
    for name in row_names:
        if name in income_stmt.index:
            try:
                val = income_stmt.loc[name].iloc[col_idx]
                if pd.notna(val):
                    return float(val)
            except (IndexError, TypeError):
                continue
    return None


def get_balance_sheet_value(balance_sheet: pd.DataFrame, row_names: list, col_idx: int = 0) -> Optional[float]:
    for name in row_names:
        if name in balance_sheet.index:
            try:
                val = balance_sheet.loc[name].iloc[col_idx]
                if pd.notna(val):
                    return float(val)
            except (IndexError, TypeError):
                continue
    return None


def get_cashflow_value(cashflow: pd.DataFrame, row_names: list, col_idx: int = 0) -> Optional[float]:
    for name in row_names:
        if name in cashflow.index:
            try:
                val = cashflow.loc[name].iloc[col_idx]
                if pd.notna(val):
                    return float(val)
            except (IndexError, TypeError):
                continue
    return None


def calculate_piotroski(info: dict, balance_sheet: pd.DataFrame, income_stmt: pd.DataFrame, cashflow: pd.DataFrame) -> int:
    score = 0
    try:
        # F1: ROA > 0 (Net Income / Total Assets)
        net_income_curr = get_income_stmt_value(income_stmt, ["Net Income", "NetIncome", "Net Income Common Stockholders"], 0)
        total_assets_curr = get_balance_sheet_value(balance_sheet, ["Total Assets", "TotalAssets"], 0)
        total_assets_prev = get_balance_sheet_value(balance_sheet, ["Total Assets", "TotalAssets"], 1)

        roa_curr = None
        if net_income_curr and total_assets_curr and total_assets_curr != 0:
            roa_curr = net_income_curr / total_assets_curr
            if roa_curr > 0:
                score += 1

        # F2: CFO > 0
        cfo = get_cashflow_value(cashflow, ["Operating Cash Flow", "Cash From Operations", "Total Cash From Operating Activities"], 0)
        if cfo and cfo > 0:
            score += 1

        # F3: Delta ROA > 0
        net_income_prev = get_income_stmt_value(income_stmt, ["Net Income", "NetIncome", "Net Income Common Stockholders"], 1)
        roa_prev = None
        if net_income_prev and total_assets_prev and total_assets_prev != 0:
            roa_prev = net_income_prev / total_assets_prev

        if roa_curr is not None and roa_prev is not None and roa_curr > roa_prev:
            score += 1

        # F4: Accruals (CFO / Total Assets > ROA)
        if cfo and total_assets_curr and total_assets_curr != 0 and roa_curr is not None:
            accrual = cfo / total_assets_curr
            if accrual > roa_curr:
                score += 1

        # F5: Delta Leverage (Long Term Debt / Total Assets)
        ltd_curr = get_balance_sheet_value(balance_sheet, ["Long Term Debt", "LongTermDebt", "Long-Term Debt"], 0)
        ltd_prev = get_balance_sheet_value(balance_sheet, ["Long Term Debt", "LongTermDebt", "Long-Term Debt"], 1)

        leverage_curr = None
        leverage_prev = None
        if ltd_curr and total_assets_curr and total_assets_curr != 0:
            leverage_curr = ltd_curr / total_assets_curr
        if ltd_prev and total_assets_prev and total_assets_prev != 0:
            leverage_prev = ltd_prev / total_assets_prev

        if leverage_curr is not None and leverage_prev is not None and leverage_curr < leverage_prev:
            score += 1

        # F6: Delta Liquidity (Current Ratio)
        current_ratio_curr = safe_float(info.get("currentRatio"))
        current_assets_curr = get_balance_sheet_value(balance_sheet, ["Current Assets", "TotalCurrentAssets", "Current Assets"], 0)
        current_liab_curr = get_balance_sheet_value(balance_sheet, ["Current Liabilities", "TotalCurrentLiabilities", "Current Liabilities"], 0)
        current_assets_prev = get_balance_sheet_value(balance_sheet, ["Current Assets", "TotalCurrentAssets", "Current Assets"], 1)
        current_liab_prev = get_balance_sheet_value(balance_sheet, ["Current Liabilities", "TotalCurrentLiabilities", "Current Liabilities"], 1)

        cr_curr = None
        cr_prev = None
        if current_assets_curr and current_liab_curr and current_liab_curr != 0:
            cr_curr = current_assets_curr / current_liab_curr
        if current_assets_prev and current_liab_prev and current_liab_prev != 0:
            cr_prev = current_assets_prev / current_liab_prev

        if cr_curr is None and current_ratio_curr:
            cr_curr = current_ratio_curr

        if cr_curr is not None and cr_prev is not None and cr_curr > cr_prev:
            score += 1

        # F7: No new shares issued
        shares_curr = get_balance_sheet_value(balance_sheet, ["Ordinary Shares Number", "Share Issued", "Common Stock Shares Outstanding"], 0)
        shares_prev = get_balance_sheet_value(balance_sheet, ["Ordinary Shares Number", "Share Issued", "Common Stock Shares Outstanding"], 1)
        if shares_curr is not None and shares_prev is not None and shares_curr <= shares_prev:
            score += 1

        # F8: Delta Gross Margin
        gross_profit_curr = get_income_stmt_value(income_stmt, ["Gross Profit", "GrossProfit"], 0)
        revenue_curr = get_income_stmt_value(income_stmt, ["Total Revenue", "Revenue", "TotalRevenue"], 0)
        gross_profit_prev = get_income_stmt_value(income_stmt, ["Gross Profit", "GrossProfit"], 1)
        revenue_prev = get_income_stmt_value(income_stmt, ["Total Revenue", "Revenue", "TotalRevenue"], 1)

        gm_curr = None
        gm_prev = None
        if gross_profit_curr and revenue_curr and revenue_curr != 0:
            gm_curr = gross_profit_curr / revenue_curr
        if gross_profit_prev and revenue_prev and revenue_prev != 0:
            gm_prev = gross_profit_prev / revenue_prev

        if gm_curr is not None and gm_prev is not None and gm_curr > gm_prev:
            score += 1

        # F9: Delta Asset Turnover
        at_curr = None
        at_prev = None
        if revenue_curr and total_assets_curr and total_assets_curr != 0:
            at_curr = revenue_curr / total_assets_curr
        if revenue_prev and total_assets_prev and total_assets_prev != 0:
            at_prev = revenue_prev / total_assets_prev

        if at_curr is not None and at_prev is not None and at_curr > at_prev:
            score += 1

    except Exception:
        pass

    return score


def calculate_growth_rate(values: list) -> Optional[float]:
    """Calculate CAGR from a list of values (newest first)."""
    try:
        clean = [v for v in values if v and not math.isnan(v) and v != 0]
        if len(clean) < 2:
            return None
        n = len(clean) - 1
        rate = (clean[0] / clean[-1]) ** (1 / n) - 1
        return round(rate * 100, 2)
    except (TypeError, ValueError, ZeroDivisionError):
        return None


async def get_stock_data(ticker: str) -> Dict[str, Any]:
    stock = yf.Ticker(ticker)
    info = stock.info

    if not info or info.get("symbol") is None and info.get("shortName") is None:
        raise ValueError(f"Ticker '{ticker}' não encontrado ou inválido.")

    # Balance sheet, income stmt, cashflow (annual)
    try:
        balance_sheet = stock.balance_sheet
    except Exception:
        balance_sheet = pd.DataFrame()

    try:
        income_stmt = stock.income_stmt
    except Exception:
        income_stmt = pd.DataFrame()

    try:
        cashflow = stock.cashflow
    except Exception:
        cashflow = pd.DataFrame()

    # BLOCO 1 — Price
    current_price = safe_float(info.get("currentPrice") or info.get("regularMarketPrice"))
    prev_close = safe_float(info.get("previousClose") or info.get("regularMarketPreviousClose"))
    change = None
    change_pct = None
    if current_price and prev_close:
        change = round(current_price - prev_close, 4)
        change_pct = round((change / prev_close) * 100, 2)

    price_data = {
        "current": current_price,
        "change": change,
        "change_pct": change_pct,
        "prev_close": prev_close,
        "day_high": safe_float(info.get("dayHigh") or info.get("regularMarketDayHigh")),
        "day_low": safe_float(info.get("dayLow") or info.get("regularMarketDayLow")),
        "week52_high": safe_float(info.get("fiftyTwoWeekHigh")),
        "week52_low": safe_float(info.get("fiftyTwoWeekLow")),
        "market_cap": format_large_number(info.get("marketCap")),
        "avg_volume": format_large_number(info.get("averageVolume")),
        "beta": safe_float(info.get("beta")),
    }

    # BLOCO 2 — Valuation
    valuation_data = {
        "pe_trailing": safe_float(info.get("trailingPE")),
        "pe_forward": safe_float(info.get("forwardPE")),
        "price_to_book": safe_float(info.get("priceToBook")),
        "price_to_sales": safe_float(info.get("priceToSalesTrailing12Months")),
        "ev_to_ebitda": safe_float(info.get("enterpriseToEbitda")),
        "peg_ratio": safe_float(info.get("pegRatio")),
    }

    # BLOCO 3 — Profitability
    total_revenue = get_income_stmt_value(income_stmt, ["Total Revenue", "Revenue", "TotalRevenue"], 0)
    free_cash_flow = safe_float(info.get("freeCashflow"))
    operating_cash_flow = safe_float(info.get("operatingCashflow"))

    fcf_margin = None
    ocf_margin = None
    if free_cash_flow and total_revenue and total_revenue != 0:
        fcf_margin = round((free_cash_flow / total_revenue) * 100, 2)
    if operating_cash_flow and total_revenue and total_revenue != 0:
        ocf_margin = round((operating_cash_flow / total_revenue) * 100, 2)

    profitability_data = {
        "net_margin": safe_float(info.get("profitMargins"), 100),
        "operating_margin": safe_float(info.get("operatingMargins"), 100),
        "fcf_margin": fcf_margin,
        "ocf_margin": ocf_margin,
        "roe": safe_float(info.get("returnOnEquity"), 100),
        "roa": safe_float(info.get("returnOnAssets"), 100),
    }

    # BLOCO 4 — Financial Strength
    total_cash = safe_float(info.get("totalCash"))
    total_debt = safe_float(info.get("totalDebt"))
    cash_to_debt = None
    if total_cash and total_debt and total_debt != 0:
        cash_to_debt = round(total_cash / total_debt, 4)

    piotroski = calculate_piotroski(info, balance_sheet, income_stmt, cashflow)

    financial_strength_data = {
        "total_cash": total_cash,
        "total_debt": total_debt,
        "cash_to_debt": cash_to_debt,
        "debt_to_equity": safe_float(info.get("debtToEquity")),
        "current_ratio": safe_float(info.get("currentRatio")),
        "quick_ratio": safe_float(info.get("quickRatio")),
        "piotroski_score": piotroski,
    }

    # BLOCO 5 — Growth
    revenue_values = []
    eps_values = []

    if not income_stmt.empty:
        for i in range(min(4, income_stmt.shape[1])):
            rev = get_income_stmt_value(income_stmt, ["Total Revenue", "Revenue", "TotalRevenue"], i)
            ni = get_income_stmt_value(income_stmt, ["Net Income", "NetIncome"], i)
            if rev:
                revenue_values.append(rev)
            if ni:
                eps_values.append(ni)

    revenue_growth_3y = calculate_growth_rate(revenue_values)
    eps_growth_3y = calculate_growth_rate(eps_values)

    # Forward estimates
    eps_next_year = None
    revenue_next_year = None
    try:
        earnings_est = stock.earnings_estimate
        if earnings_est is not None and not earnings_est.empty:
            if "+1y" in earnings_est.index:
                eps_next_year = safe_float(earnings_est.loc["+1y", "avg"])
    except Exception:
        pass

    try:
        rev_est = stock.revenue_estimate
        if rev_est is not None and not rev_est.empty:
            if "+1y" in rev_est.index:
                revenue_next_year = safe_float(rev_est.loc["+1y", "avg"])
    except Exception:
        pass

    growth_data = {
        "revenue_growth_yoy": safe_float(info.get("revenueGrowth"), 100),
        "earnings_growth_yoy": safe_float(info.get("earningsGrowth"), 100),
        "revenue_growth_3y": revenue_growth_3y,
        "eps_growth_3y": eps_growth_3y,
        "eps_estimate_next_year": eps_next_year,
        "revenue_estimate_next_year": revenue_next_year,
    }

    # BLOCO 6 — Analysts
    analysts_data = {
        "price_target": {"current": current_price, "mean": None, "low": None, "high": None},
        "recommendations": {"strongBuy": 0, "buy": 0, "hold": 0, "sell": 0, "strongSell": 0},
        "recent_actions": [],
        "earnings_estimates": {"current_quarter": None, "next_year": None},
    }

    try:
        pt = stock.analyst_price_targets
        if pt is not None and not pt.empty:
            row = pt.iloc[0] if isinstance(pt, pd.DataFrame) else pt
            analysts_data["price_target"] = {
                "current": current_price,
                "mean": safe_float(row.get("mean") if hasattr(row, "get") else None),
                "low": safe_float(row.get("low") if hasattr(row, "get") else None),
                "high": safe_float(row.get("high") if hasattr(row, "get") else None),
            }
    except Exception:
        pass

    try:
        rec = stock.recommendations_summary
        if rec is not None and not rec.empty:
            latest = rec.iloc[0]
            analysts_data["recommendations"] = {
                "strongBuy": int(latest.get("strongBuy", 0) or 0),
                "buy": int(latest.get("buy", 0) or 0),
                "hold": int(latest.get("hold", 0) or 0),
                "sell": int(latest.get("sell", 0) or 0),
                "strongSell": int(latest.get("strongSell", 0) or 0),
            }
    except Exception:
        pass

    try:
        upgrades = stock.upgrades_downgrades
        if upgrades is not None and not upgrades.empty:
            recent = upgrades.head(5)
            actions = []
            for idx, row in recent.iterrows():
                date_str = str(idx.date()) if hasattr(idx, "date") else str(idx)
                actions.append({
                    "firm": str(row.get("Firm", "")),
                    "action": str(row.get("Action", "")),
                    "from_grade": str(row.get("FromGrade", "")) or None,
                    "to_grade": str(row.get("ToGrade", "")) or None,
                    "date": date_str,
                })
            analysts_data["recent_actions"] = actions
    except Exception:
        pass

    try:
        ee = stock.earnings_estimate
        if ee is not None and not ee.empty:
            quarters = [idx for idx in ee.index if idx not in ["+1y", "+5y", "0y", "-1y"]]
            if quarters:
                q = quarters[0]
                analysts_data["earnings_estimates"]["current_quarter"] = {
                    "estimate": safe_float(ee.loc[q, "avg"]),
                    "period": str(q),
                }
            if "+1y" in ee.index:
                analysts_data["earnings_estimates"]["next_year"] = {
                    "estimate": safe_float(ee.loc["+1y", "avg"]),
                    "period": "+1 year",
                }
    except Exception:
        pass

    return {
        "ticker": ticker.upper(),
        "company_name": info.get("shortName") or info.get("longName"),
        "sector": info.get("sector"),
        "industry": info.get("industry"),
        "price": price_data,
        "metrics": {
            "valuation": valuation_data,
            "profitability": profitability_data,
            "financial_strength": financial_strength_data,
            "growth": growth_data,
        },
        "analysts": analysts_data,
        "raw_info": info,
    }
