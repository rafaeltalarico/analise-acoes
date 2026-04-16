import React from 'react';
import type { Analysts } from '../types/stock';

function fmt(v: number | null | undefined, decimals = 2): string {
  if (v == null) return '—';
  return v.toFixed(decimals);
}

interface Props {
  analysts: Analysts;
}

export function AnalystBlock({ analysts }: Props) {
  const { price_target, recommendations, recent_actions, earnings_estimates } = analysts;

  const totalRecs =
    recommendations.strongBuy +
    recommendations.buy +
    recommendations.hold +
    recommendations.sell +
    recommendations.strongSell;

  const recBars: { label: string; value: number; color: string }[] = [
    { label: 'Strong Buy', value: recommendations.strongBuy, color: '#1D9E75' },
    { label: 'Buy', value: recommendations.buy, color: '#6ee7b7' },
    { label: 'Hold', value: recommendations.hold, color: '#EF9F27' },
    { label: 'Sell', value: recommendations.sell, color: '#fca5a5' },
    { label: 'Strong Sell', value: recommendations.strongSell, color: '#E24B4A' },
  ];

  // Price target bar position
  const ptLow = price_target.low ?? 0;
  const ptHigh = price_target.high ?? 1;
  const ptCurrent = price_target.current ?? 0;
  const ptMean = price_target.mean ?? 0;
  const range = ptHigh - ptLow || 1;
  const currentPct = Math.max(0, Math.min(100, ((ptCurrent - ptLow) / range) * 100));
  const meanPct = Math.max(0, Math.min(100, ((ptMean - ptLow) / range) * 100));

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-700 mb-5">Análise de Analistas</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Price targets */}
        <div>
          <h3 className="text-sm font-semibold text-gray-600 mb-3">Price Targets</h3>
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Min: ${fmt(price_target.low)}</span>
            <span>Médio: <strong className="text-gray-700">${fmt(price_target.mean)}</strong></span>
            <span>Max: ${fmt(price_target.high)}</span>
          </div>
          <div className="relative h-4 bg-gray-100 rounded-full mb-2">
            <div
              className="absolute top-0 h-4 bg-green-200 rounded-full"
              style={{ left: `${currentPct}%`, width: `${Math.max(0, meanPct - currentPct)}%` }}
            />
            {/* Current price marker */}
            <div
              className="absolute -top-1 w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow flex items-center justify-center"
              style={{ left: `calc(${currentPct}% - 12px)` }}
              title={`Atual: $${fmt(price_target.current)}`}
            />
            {/* Mean target marker */}
            <div
              className="absolute -top-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white shadow"
              style={{ left: `calc(${meanPct}% - 12px)` }}
              title={`Médio: $${fmt(price_target.mean)}`}
            />
          </div>
          <div className="flex gap-3 text-xs text-gray-500 mt-2">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span> Atual</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block"></span> Consenso</span>
          </div>

          {/* Earnings estimates */}
          {(earnings_estimates.current_quarter || earnings_estimates.next_year) && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-gray-600 mb-2">EPS Estimado</h3>
              <div className="space-y-1 text-sm">
                {earnings_estimates.current_quarter && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">{earnings_estimates.current_quarter.period}</span>
                    <span className="font-medium">${fmt(earnings_estimates.current_quarter.estimate)}</span>
                  </div>
                )}
                {earnings_estimates.next_year && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">{earnings_estimates.next_year.period}</span>
                    <span className="font-medium">${fmt(earnings_estimates.next_year.estimate)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Recommendations */}
        <div>
          <h3 className="text-sm font-semibold text-gray-600 mb-3">
            Recomendações ({totalRecs} analistas)
          </h3>
          <div className="space-y-2">
            {recBars.map(({ label, value, color }) => (
              <div key={label} className="flex items-center gap-2 text-sm">
                <span className="w-20 text-right text-gray-500 text-xs">{label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-5 relative">
                  <div
                    className="h-5 rounded-full transition-all"
                    style={{
                      width: totalRecs > 0 ? `${(value / totalRecs) * 100}%` : '0%',
                      backgroundColor: color,
                    }}
                  />
                </div>
                <span className="w-6 text-xs text-gray-600 font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent actions */}
      {recent_actions && recent_actions.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-3">Últimas Movimentações</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                  <th className="pb-2">Firma</th>
                  <th className="pb-2">Ação</th>
                  <th className="pb-2">De</th>
                  <th className="pb-2">Para</th>
                  <th className="pb-2">Data</th>
                </tr>
              </thead>
              <tbody>
                {recent_actions.map((action, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2 font-medium text-gray-700">{action.firm}</td>
                    <td className="py-2">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          backgroundColor: action.action?.toLowerCase().includes('up') ? '#d1fae5' : action.action?.toLowerCase().includes('down') ? '#fee2e2' : '#f3f4f6',
                          color: action.action?.toLowerCase().includes('up') ? '#1D9E75' : action.action?.toLowerCase().includes('down') ? '#E24B4A' : '#6b7280',
                        }}
                      >
                        {action.action}
                      </span>
                    </td>
                    <td className="py-2 text-gray-400">{action.from_grade || '—'}</td>
                    <td className="py-2 text-gray-700">{action.to_grade || '—'}</td>
                    <td className="py-2 text-gray-400">{action.date || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
