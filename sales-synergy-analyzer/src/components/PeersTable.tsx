import React from 'react';
import type { PeerData } from '../types/stock';

function fmt(v: number | null | undefined, decimals = 2, suffix = ''): string {
  if (v == null) return '—';
  return `${v.toFixed(decimals)}${suffix}`;
}

interface Props {
  peers: PeerData[];
  mainTicker: string;
  industry: string | null;
}

export function PeersTable({ peers, mainTicker, industry }: Props) {
  if (!peers || peers.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-2">
          Concorrentes{industry ? ` — ${industry}` : ''}
        </h2>
        <p className="text-sm text-gray-400">Dados de concorrentes não disponíveis para este setor.</p>
      </div>
    );
  }

  // Calculate average forward PE to badge above/below average
  const peValues = peers.map(p => p.pe_forward).filter((v): v is number => v != null);
  const avgPE = peValues.length > 0 ? peValues.reduce((a, b) => a + b, 0) / peValues.length : null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-700 mb-4">
        Concorrentes{industry ? ` — ${industry}` : ''}
      </h2>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 border-b border-gray-200">
              <th className="pb-3 pr-4">Empresa</th>
              <th className="pb-3 pr-4 text-right">Preço</th>
              <th className="pb-3 pr-4 text-right">Var%</th>
              <th className="pb-3 pr-4 text-right">P/E Fwd</th>
              <th className="pb-3 pr-4 text-right">P/B</th>
              <th className="pb-3 pr-4 text-right">Mkt Cap</th>
              <th className="pb-3 pr-4 text-right">Net Margin</th>
              <th className="pb-3 pr-4 text-right">ROE</th>
              <th className="pb-3 pr-4 text-right">Div%</th>
              <th className="pb-3 text-right">Beta</th>
            </tr>
          </thead>
          <tbody>
            {peers.map((peer, i) => {
              const isMain = peer.ticker === mainTicker;
              const peFwd = peer.pe_forward;
              const peBelowAvg = avgPE != null && peFwd != null && peFwd < avgPE;
              const peAboveAvg = avgPE != null && peFwd != null && peFwd >= avgPE;

              return (
                <tr
                  key={peer.ticker}
                  className={`border-b border-gray-50 ${isMain ? 'bg-blue-50' : i % 2 === 0 ? '' : 'bg-gray-50/30'}`}
                >
                  <td className="py-3 pr-4">
                    <div className="font-semibold text-gray-900">{peer.ticker}</div>
                    <div className="text-xs text-gray-400 truncate max-w-[120px]">{peer.company_name}</div>
                  </td>
                  <td className="py-3 pr-4 text-right font-medium">
                    {peer.price != null ? `$${peer.price.toFixed(2)}` : '—'}
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <span className={peer.change_pct != null && peer.change_pct >= 0 ? 'text-green-600' : 'text-red-500'}>
                      {peer.change_pct != null ? `${peer.change_pct >= 0 ? '+' : ''}${peer.change_pct.toFixed(2)}%` : '—'}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right">
                    {peFwd != null ? (
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          backgroundColor: peBelowAvg ? '#d1fae5' : '#fee2e2',
                          color: peBelowAvg ? '#1D9E75' : '#E24B4A',
                        }}
                      >
                        {fmt(peFwd)}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="py-3 pr-4 text-right">{fmt(peer.price_to_book)}</td>
                  <td className="py-3 pr-4 text-right">{peer.market_cap ?? '—'}</td>
                  <td className="py-3 pr-4 text-right">{fmt(peer.net_margin, 2, '%')}</td>
                  <td className="py-3 pr-4 text-right">{fmt(peer.roe, 2, '%')}</td>
                  <td className="py-3 pr-4 text-right">{fmt(peer.dividend_yield, 2, '%')}</td>
                  <td className="py-3 text-right">{fmt(peer.beta)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {avgPE && (
          <p className="text-xs text-gray-400 mt-2">
            P/E Forward médio do grupo: {avgPE.toFixed(1)} — verde = abaixo da média, vermelho = acima
          </p>
        )}
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {peers.map(peer => (
          <div key={peer.ticker} className={`border border-gray-200 rounded-lg p-4 ${peer.ticker === mainTicker ? 'bg-blue-50 border-blue-200' : ''}`}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="font-bold text-gray-900">{peer.ticker}</div>
                <div className="text-xs text-gray-400">{peer.company_name}</div>
              </div>
              <div className="text-right">
                <div className="font-medium">{peer.price != null ? `$${peer.price.toFixed(2)}` : '—'}</div>
                <div className={`text-xs ${(peer.change_pct ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {peer.change_pct != null ? `${peer.change_pct >= 0 ? '+' : ''}${peer.change_pct.toFixed(2)}%` : '—'}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div><span className="text-gray-400">P/E Fwd</span><div>{fmt(peer.pe_forward)}</div></div>
              <div><span className="text-gray-400">P/B</span><div>{fmt(peer.price_to_book)}</div></div>
              <div><span className="text-gray-400">Mkt Cap</span><div>{peer.market_cap ?? '—'}</div></div>
              <div><span className="text-gray-400">Net Margin</span><div>{fmt(peer.net_margin, 2, '%')}</div></div>
              <div><span className="text-gray-400">ROE</span><div>{fmt(peer.roe, 2, '%')}</div></div>
              <div><span className="text-gray-400">Beta</span><div>{fmt(peer.beta)}</div></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
