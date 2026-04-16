import React, { useState } from 'react';
import type { Metrics } from '../types/stock';

function fmt(v: number | null | undefined, suffix = '', decimals = 2): string {
  if (v == null) return '—';
  return `${v.toFixed(decimals)}${suffix}`;
}

function fmtLarge(v: number | null | undefined): string {
  if (v == null) return '—';
  if (Math.abs(v) >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return `$${v.toFixed(0)}`;
}

interface BlockProps {
  title: string;
  rows: [string, string][];
}

function CollapsibleBlock({ title, rows }: BlockProps) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        className="w-full flex justify-between items-center px-5 py-4 bg-gray-50 hover:bg-gray-100 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className="font-semibold text-gray-700">{title}</span>
        <span className="text-gray-400 text-sm">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 px-5 py-4">
          {rows.map(([label, value]) => (
            <React.Fragment key={label}>
              <span className="text-sm text-gray-500">{label}</span>
              <span className="text-sm font-medium text-gray-900 text-right">{value}</span>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  metrics: Metrics;
}

export function MetricsBlock({ metrics }: Props) {
  const { valuation, profitability, financial_strength, growth } = metrics;

  const valuationRows: [string, string][] = [
    ['P/E Trailing', fmt(valuation.pe_trailing)],
    ['P/E Forward', fmt(valuation.pe_forward)],
    ['P/B', fmt(valuation.price_to_book)],
    ['P/S (TTM)', fmt(valuation.price_to_sales)],
    ['EV/EBITDA', fmt(valuation.ev_to_ebitda)],
    ['PEG Ratio', fmt(valuation.peg_ratio)],
  ];

  const profitabilityRows: [string, string][] = [
    ['Net Margin', fmt(profitability.net_margin, '%')],
    ['Operating Margin', fmt(profitability.operating_margin, '%')],
    ['FCF Margin', fmt(profitability.fcf_margin, '%')],
    ['OCF Margin', fmt(profitability.ocf_margin, '%')],
    ['ROE', fmt(profitability.roe, '%')],
    ['ROA', fmt(profitability.roa, '%')],
  ];

  const strengthRows: [string, string][] = [
    ['Caixa Total', fmtLarge(financial_strength.total_cash)],
    ['Dívida Total', fmtLarge(financial_strength.total_debt)],
    ['Cash-to-Debt', fmt(financial_strength.cash_to_debt)],
    ['Debt/Equity', fmt(financial_strength.debt_to_equity)],
    ['Current Ratio', fmt(financial_strength.current_ratio)],
    ['Quick Ratio', fmt(financial_strength.quick_ratio)],
    ['Piotroski F-Score', financial_strength.piotroski_score != null ? `${financial_strength.piotroski_score}/9` : '—'],
  ];

  const growthRows: [string, string][] = [
    ['Receita YoY', fmt(growth.revenue_growth_yoy, '%')],
    ['Lucro YoY', fmt(growth.earnings_growth_yoy, '%')],
    ['Receita 3Y CAGR', fmt(growth.revenue_growth_3y, '%')],
    ['EPS 3Y CAGR', fmt(growth.eps_growth_3y, '%')],
    ['EPS Est. Próx. Ano', growth.eps_estimate_next_year != null ? `$${growth.eps_estimate_next_year.toFixed(2)}` : '—'],
    ['Receita Est. Próx. Ano', fmtLarge(growth.revenue_estimate_next_year)],
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
      <CollapsibleBlock title="Valuation" rows={valuationRows} />
      <CollapsibleBlock title="Lucratividade" rows={profitabilityRows} />
      <CollapsibleBlock title="Solidez Financeira" rows={strengthRows} />
      <CollapsibleBlock title="Crescimento" rows={growthRows} />
    </div>
  );
}
