import React from 'react';
import type { EarningsSummary as EarningsSummaryType } from '../types/stock';

const SENTIMENT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  POSITIVO: { bg: '#d1fae5', text: '#1D9E75', label: 'POSITIVO' },
  NEUTRO: { bg: '#fef9c3', text: '#92400e', label: 'NEUTRO' },
  NEGATIVO: { bg: '#fee2e2', text: '#E24B4A', label: 'NEGATIVO' },
};

interface Props {
  earnings: EarningsSummaryType;
}

export function EarningsSummary({ earnings }: Props) {
  if (!earnings.available) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-2">Resumo de Earnings</h2>
        <p className="text-sm text-gray-400">Earnings release não encontrado na SEC.</p>
      </div>
    );
  }

  const sentimentConfig = earnings.sentiment ? SENTIMENT_COLORS[earnings.sentiment] : null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-gray-700">Resumo de Earnings</h2>
        {sentimentConfig && (
          <span
            className="px-3 py-1 rounded-full text-sm font-bold"
            style={{ backgroundColor: sentimentConfig.bg, color: sentimentConfig.text }}
          >
            {sentimentConfig.label}
          </span>
        )}
        {earnings.filing_date && (
          <span className="text-xs text-gray-400">Filing: {earnings.filing_date}</span>
        )}
      </div>

      {earnings.text && (
        <p className="text-sm text-gray-700 leading-relaxed mb-4">{earnings.text}</p>
      )}

      {earnings.highlights && earnings.highlights.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">Destaques</h3>
          <ul className="space-y-1">
            {earnings.highlights.map((h, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-700">
                <span className="text-green-500 flex-shrink-0">•</span>
                {h}
              </li>
            ))}
          </ul>
        </div>
      )}

      {earnings.outlook && (
        <div className="bg-blue-50 rounded-lg px-4 py-3">
          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Outlook</span>
          <p className="text-sm text-gray-700 mt-1">{earnings.outlook}</p>
        </div>
      )}
    </div>
  );
}
