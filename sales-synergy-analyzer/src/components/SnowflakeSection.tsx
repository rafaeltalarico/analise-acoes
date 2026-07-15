import { useState } from 'react';
import type { SnowflakeAnalysis, SnowflakeCheck, SnowflakeGroup } from '../types/stock';

interface Props {
  data: SnowflakeAnalysis;
}

const SECTIONS = [
  { key: 'value'    as const, label: 'Valuation',           color: 'blue'   },
  { key: 'future'   as const, label: 'Future',  color: 'green'  },
  { key: 'past'     as const, label: 'Past', color: 'purple' },
  { key: 'health'   as const, label: 'Health',    color: 'orange' },
  { key: 'dividend' as const, label: 'Dividends',          color: 'pink'   },
] as const;

const COLORS: Record<string, { header: string; border: string; badge: string; text: string }> = {
  blue:   { header: 'bg-blue-50',   border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-700',   text: 'text-blue-700'   },
  green:  { header: 'bg-green-50',  border: 'border-green-200',  badge: 'bg-green-100 text-green-700', text: 'text-green-700'  },
  purple: { header: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700', text: 'text-purple-700' },
  orange: { header: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700', text: 'text-orange-700' },
  pink:   { header: 'bg-pink-50',   border: 'border-pink-200',   badge: 'bg-pink-100 text-pink-700',   text: 'text-pink-700'   },
};

function CheckIcon({ passed }: { passed: boolean | null }) {
  if (passed === true)  return <span className="text-green-500 font-bold text-base">✓</span>;
  if (passed === false) return <span className="text-red-400 font-bold text-base">✗</span>;
  return <span className="text-gray-400 text-base">—</span>;
}

function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  const fill = pct >= 67 ? 'bg-green-500' : pct >= 34 ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 bg-gray-200 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${fill} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Panel({ label, group, color }: { label: string; group: SnowflakeGroup; color: string }) {
  const [open, setOpen] = useState(false);
  const cls = COLORS[color] ?? COLORS.blue;

  return (
    <div className={`rounded-xl border ${cls.border} overflow-hidden`}>
      <button
        className={`w-full flex items-center gap-3 px-4 py-3 ${cls.header} hover:opacity-90 transition text-left`}
        onClick={() => setOpen(o => !o)}
      >
        <span className={`text-sm font-semibold ${cls.text} w-40 shrink-0`}>{label}</span>
        <ScoreBar score={group.score} max={group.max} />
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${cls.badge}`}>
          {group.score}/{group.max}
        </span>
        <span className={`text-xs ${cls.text} shrink-0`}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="divide-y divide-gray-100">
          {group.checks.map((c: SnowflakeCheck) => (
            <div key={c.key} className="flex items-start gap-3 px-4 py-3 bg-white">
              <div className="mt-0.5 shrink-0 w-5 text-center">
                <CheckIcon passed={c.passed} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{c.label}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{c.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SnowflakeSection({ data }: Props) {
  const [mgmtOpen, setMgmtOpen] = useState(false);

  return (
    <div className="space-y-2">
      {SECTIONS.map(({ key, label, color }) => (
        <Panel key={key} label={label} group={data[key]} color={color} />
      ))}
    </div>
  );
}
