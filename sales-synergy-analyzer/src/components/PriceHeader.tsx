import React from 'react';
import type { StockAnalysis, HistoryPoint } from '../types/stock';
import { PriceChart } from './PriceChart';

function fmt(v: number | null, decimals = 2): string {
  if (v == null) return '—';
  return v.toFixed(decimals);
}

interface Props {
  data: StockAnalysis;
}

export function PriceHeader({ data }: Props) {
  const { ticker, company_name, sector, industry, price } = data;
  const isPositive = (price.change ?? 0) >= 0;

  const low52 = price.week52_low ?? 0;
  const high52 = price.week52_high ?? 1;
  const curr = price.current ?? 0;
  const rangePercent = high52 !== low52 ? ((curr - low52) / (high52 - low52)) * 100 : 50;
  const clampedRange = Math.max(0, Math.min(100, rangePercent));

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-3">
            <h1 className="text-4xl font-bold text-gray-900">{ticker}</h1>
            <span className="text-xl text-gray-500">{company_name}</span>
          </div>
          {(sector || industry) && (
            <p className="text-sm text-gray-400 mt-1">
              {sector} {sector && industry ? '›' : ''} {industry}
            </p>
          )}
        </div>

        <div className="text-right">
          <div className="text-4xl font-bold text-gray-900">
            ${fmt(price.current)}
          </div>
          <div className={`text-lg font-medium ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
            {isPositive ? '+' : ''}{fmt(price.change)} ({isPositive ? '+' : ''}{fmt(price.change_pct)}%)
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-gray-400">Abertura</span>
          <div className="font-medium">${fmt(price.prev_close)}</div>
        </div>
        <div>
          <span className="text-gray-400">Máx/Mín do dia</span>
          <div className="font-medium">${fmt(price.day_high)} / ${fmt(price.day_low)}</div>
        </div>
        <div>
          <span className="text-gray-400">Mkt Cap</span>
          <div className="font-medium">{price.market_cap ?? '—'}</div>
        </div>
        <div>
          <span className="text-gray-400">Vol. Médio</span>
          <div className="font-medium">{price.avg_volume ?? '—'}</div>
        </div>
      </div>

      {/* 52-week range bar */}
      <div className="mt-5">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>52w Mín: ${fmt(price.week52_low)}</span>
          <span>52w Máx: ${fmt(price.week52_high)}</span>
        </div>
        <PriceChart ticker={data.ticker} />
        <div className="relative h-2 bg-gray-200 rounded-full">
          <div
            className="absolute top-0 h-2 bg-blue-400 rounded-full"
            style={{ width: `${clampedRange}%` }}
          />
          <div
            className="absolute -top-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow"
            style={{ left: `calc(${clampedRange}% - 8px)` }}
          />
        </div>
        <div className="text-center text-xs text-gray-400 mt-1">
          Beta: {fmt(price.beta)}
        </div>
      </div>
    </div>
  );
}
