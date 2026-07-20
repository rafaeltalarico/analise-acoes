import React from 'react';
import type { StockAnalysis } from '../types/stock';
import { PriceChart } from './PriceChart';

function fmt(v: number | null | undefined, decimals = 2): string {
  if (v == null) return '—';
  return v.toFixed(decimals);
}

interface Props {
  data: StockAnalysis;
}

// ─── Colours ──────────────────────────────────────────────────────────────────
const C_PANEL  = '#161c2c';
const C_BORDER = '#1e2640';
const C_LABEL  = '#5a6478';
const C_VALUE  = '#d0d8e8';
const C_DIM    = '#8892a4';

export function PriceHeader({ data }: Props) {
  const { ticker, company_name, sector, industry, price } = data;

  const changeAmt = price.change ?? 0;
  const isPositive = changeAmt >= 0;

  const low52       = price.week52_low  ?? 0;
  const high52      = price.week52_high ?? 1;
  const curr        = price.current     ?? 0;
  const rangePct    = high52 !== low52 ? ((curr - low52) / (high52 - low52)) * 100 : 50;
  const clampedRange = Math.max(0, Math.min(100, rangePct));

  return (
    <div
      className="rounded-xl p-6 mb-6"
      style={{ background: C_PANEL, border: `1px solid ${C_BORDER}` }}
    >
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="text-4xl font-bold text-white">{ticker}</h1>
            <span className="text-xl" style={{ color: C_DIM }}>{company_name}</span>
          </div>
          {(sector || industry) && (
            <p className="text-sm mt-1" style={{ color: C_LABEL }}>
              {sector} {sector && industry ? '›' : ''} {industry}
            </p>
          )}
        </div>

        <div className="text-right">
          <div className="text-4xl font-bold text-white">
            ${fmt(price.current)}
          </div>
          <div className={`text-lg font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{fmt(changeAmt)} ({isPositive ? '+' : ''}{fmt(price.change_pct)}%)
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div>
          <span style={{ color: C_LABEL }}>Abertura</span>
          <div className="font-medium mt-0.5" style={{ color: C_VALUE }}>
            {price.prev_close != null ? `$${fmt(price.prev_close)}` : '—'}
          </div>
        </div>
        <div>
          <span style={{ color: C_LABEL }}>Máx / Mín</span>
          <div className="font-medium mt-0.5" style={{ color: C_VALUE }}>
            {price.day_high != null ? `$${fmt(price.day_high)}` : '—'} /{' '}
            {price.day_low  != null ? `$${fmt(price.day_low)}`  : '—'}
          </div>
        </div>
        <div>
          <span style={{ color: C_LABEL }}>Mkt Cap</span>
          <div className="font-medium mt-0.5" style={{ color: C_VALUE }}>
            {price.market_cap ?? '—'}
          </div>
        </div>
        <div>
          <span style={{ color: C_LABEL }}>Vol. Médio</span>
          <div className="font-medium mt-0.5" style={{ color: C_VALUE }}>
            {price.avg_volume ?? '—'}
          </div>
        </div>
      </div>

      {/* 52-week range */}
      <div className="mt-5">
        <div className="flex justify-between text-xs mb-2" style={{ color: C_LABEL }}>
          <span>52w Mín: {price.week52_low != null ? `$${fmt(price.week52_low)}` : '—'}</span>
          <span>52w Máx: {price.week52_high != null ? `$${fmt(price.week52_high)}` : '—'}</span>
        </div>

        <PriceChart ticker={ticker} />

        <div className="relative h-1.5 rounded-full mt-4" style={{ background: '#2a3255' }}>
          <div
            className="absolute top-0 h-1.5 rounded-full"
            style={{ width: `${clampedRange}%`, background: '#378ADD' }}
          />
          <div
            className="absolute -top-1 w-3.5 h-3.5 rounded-full border-2 border-[#161c2c]"
            style={{
              left: `calc(${clampedRange}% - 7px)`,
              background: '#378ADD',
              boxShadow: '0 0 6px rgba(55,138,221,0.6)',
            }}
          />
        </div>

        <div className="text-center text-xs mt-2" style={{ color: C_LABEL }}>
          Beta: {fmt(price.beta)}
        </div>
      </div>
    </div>
  );
}
