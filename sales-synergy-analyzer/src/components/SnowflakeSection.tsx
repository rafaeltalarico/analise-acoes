import { useState } from 'react';
import type { SnowflakeAnalysis, SnowflakeCheck, SnowflakeGroup } from '../types/stock';

interface Props {
  data: SnowflakeAnalysis;
}

const SECTIONS = [
  { key: 'value'    as const, label: 'Valuation',  color: 'blue'   },
  { key: 'future'   as const, label: 'Future',     color: 'green'  },
  { key: 'past'     as const, label: 'Past',       color: 'purple' },
  { key: 'health'   as const, label: 'Health',     color: 'orange' },
  { key: 'dividend' as const, label: 'Dividends',  color: 'pink'   },
] as const;

// Dark-theme colour palette per section
const COLORS: Record<string, {
  header: string; border: string; badge: string; text: string;
  bar: string; barBg: string;
}> = {
  blue:   { header: '#0e1f3d', border: '#1e3d7b', badge: '#1e3d7b', text: '#60a5fa', bar: '#3b82f6', barBg: '#0e1f3d' },
  green:  { header: '#0a2518', border: '#145a2d', badge: '#145a2d', text: '#4ade80', bar: '#22c55e', barBg: '#0a2518' },
  purple: { header: '#160c35', border: '#3a1a7a', badge: '#3a1a7a', text: '#a78bfa', bar: '#8b5cf6', barBg: '#160c35' },
  orange: { header: '#231108', border: '#5c2e08', badge: '#5c2e08', text: '#fb923c', bar: '#f97316', barBg: '#231108' },
  pink:   { header: '#220a18', border: '#5c1430', badge: '#5c1430', text: '#f472b6', bar: '#ec4899', barBg: '#220a18' },
};

const C_CHECK_BG  = '#0d1117';
const C_DIVIDER   = '#1e2640';
const C_CHECK_TXT = '#d0d8e8';
const C_CHECK_DIM = '#6b7280';

function CheckIcon({ passed }: { passed: boolean | null }) {
  if (passed === true)  return <span style={{ color: '#4ade80', fontWeight: 700, fontSize: 15 }}>✓</span>;
  if (passed === false) return <span style={{ color: '#f87171', fontWeight: 700, fontSize: 15 }}>✗</span>;
  return <span style={{ color: '#4b5563', fontSize: 15 }}>—</span>;
}

function ScoreBar({ score, max, barColor }: { score: number; max: number; barColor: string }) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  const fill = pct >= 67 ? '#22c55e' : pct >= 34 ? '#eab308' : '#ef4444';
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 rounded-full h-1.5" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div
          className="h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: fill }}
        />
      </div>
    </div>
  );
}

function Panel({ label, group, color }: { label: string; group: SnowflakeGroup; color: string }) {
  const [open, setOpen] = useState(false);
  const cls = COLORS[color] ?? COLORS.blue;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: `1px solid ${cls.border}` }}
    >
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-opacity hover:opacity-90"
        style={{ background: cls.header }}
        onClick={() => setOpen(o => !o)}
      >
        <span
          className="text-sm font-semibold shrink-0"
          style={{ color: cls.text, width: 100 }}
        >
          {label}
        </span>
        <ScoreBar score={group.score} max={group.max} barColor={cls.bar} />
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
          style={{ background: cls.badge, color: cls.text }}
        >
          {group.score}/{group.max}
        </span>
        <span className="text-xs shrink-0" style={{ color: cls.text }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div style={{ background: C_CHECK_BG }}>
          {group.checks.map((c: SnowflakeCheck, i) => (
            <div
              key={c.key}
              className="flex items-start gap-3 px-4 py-3"
              style={{
                borderTop: i === 0 ? `1px solid ${C_DIVIDER}` : undefined,
                borderBottom: i < group.checks.length - 1 ? `1px solid ${C_DIVIDER}` : undefined,
              }}
            >
              <div className="mt-0.5 shrink-0 w-5 text-center">
                <CheckIcon passed={c.passed} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: C_CHECK_TXT }}>{c.label}</p>
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: C_CHECK_DIM }}>{c.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SnowflakeSection({ data }: Props) {
  return (
    <div className="space-y-2">
      {SECTIONS.map(({ key, label, color }) => (
        <Panel key={key} label={label} group={data[key]} color={color} />
      ))}
    </div>
  );
}
