import React, { useState } from 'react';
import type { ScoreDetail } from '../types/stock';

const SCORE_LABELS: Record<string, string> = {
  financial_strength: 'Solidez Financeira',
  profitability: 'Lucratividade',
  growth: 'Crescimento',
  valuation: 'Valuation',
  momentum: 'Momentum',
};

function scoreColor(score: number): string {
  if (score >= 7) return '#1D9E75';
  if (score >= 4) return '#EF9F27';
  return '#E24B4A';
}

function GaugeSVG({ score }: { score: number }) {
  const color = scoreColor(score);
  const angle = (score / 10) * 180 - 180;
  const rad = (angle * Math.PI) / 180;
  const cx = 60;
  const cy = 60;
  const r = 45;
  const x = cx + r * Math.cos(rad);
  const y = cy + r * Math.sin(rad);

  return (
    <svg viewBox="0 0 120 70" className="w-28 h-16">
      {/* Background arc */}
      <path
        d="M 15 60 A 45 45 0 0 1 105 60"
        fill="none"
        stroke="#e5e7eb"
        strokeWidth="10"
        strokeLinecap="round"
      />
      {/* Colored arc */}
      <path
        d="M 15 60 A 45 45 0 0 1 105 60"
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${(score / 10) * 141.37} 141.37`}
      />
      {/* Needle */}
      <line
        x1={cx}
        y1={cy}
        x2={x}
        y2={y}
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r="4" fill={color} />
    </svg>
  );
}

interface Props {
  scoreKey: string;
  detail: ScoreDetail | null;
}

export function ScoreCard({ scoreKey, detail }: Props) {
  const [expanded, setExpanded] = useState(false);
  const label = SCORE_LABELS[scoreKey] || scoreKey;

  if (!detail) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col items-center gap-2">
        <div className="text-sm font-medium text-gray-500">{label}</div>
        <div className="text-3xl font-bold text-gray-300">—</div>
        <div className="text-xs text-gray-400">IA indisponível</div>
      </div>
    );
  }

  const color = scoreColor(detail.score);

  return (
    <div
      className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col items-center gap-2 cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="text-sm font-semibold text-gray-600 text-center">{label}</div>
      <GaugeSVG score={detail.score} />
      <div className="text-4xl font-bold" style={{ color }}>
        {detail.score}
        <span className="text-lg text-gray-400">/10</span>
      </div>
      <p className="text-xs text-gray-500 text-center leading-tight">{detail.justificativa}</p>

      {expanded && detail.detalhes && Object.keys(detail.detalhes).length > 0 && (
        <div className="mt-3 w-full border-t border-gray-100 pt-3 space-y-1">
          {Object.entries(detail.detalhes).map(([k, v]) => (
            <div key={k} className="text-xs text-gray-600">
              <span className="font-medium text-gray-700">{k.replace(/_/g, ' ')}: </span>
              {v}
            </div>
          ))}
        </div>
      )}
      <div className="text-xs text-gray-300 mt-1">{expanded ? '▲ fechar' : '▼ detalhes'}</div>
    </div>
  );
}
