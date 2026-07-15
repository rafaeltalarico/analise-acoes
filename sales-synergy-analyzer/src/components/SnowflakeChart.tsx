import { useState } from 'react';
import type { SnowflakeAnalysis } from '../types/stock';

interface Props {
  data: SnowflakeAnalysis;
}

const AXES = [
  { key: 'value'    as const, label: 'VALUE'    },
  { key: 'future'   as const, label: 'FUTURE'   },
  { key: 'past'     as const, label: 'PAST'     },
  { key: 'health'   as const, label: 'HEALTH'   },
  { key: 'dividend' as const, label: 'DIVIDEND' },
];

const SIZE     = 340;
const CENTER   = SIZE / 2;   // 170
const MAX_R    = 88;
const BG_R     = 118;
const LABEL_R  = 104;
const N        = AXES.length;

const LIME      = '#bed12a';
const LIME_DIM  = 'rgba(190,209,42,0.78)';
const DARK_BG   = '#191c2b';
const DARK_RING = '#363b55';
const GRID      = '#252a3d';
const SPOKE_HL  = '#4a5070';

function polar(r: number, idx: number) {
  const a = (2 * Math.PI * idx) / N - Math.PI / 2;
  return { x: CENTER + r * Math.cos(a), y: CENTER + r * Math.sin(a) };
}

function labelAnchor(idx: number): 'start' | 'middle' | 'end' {
  const cosA = Math.cos((2 * Math.PI * idx) / N - Math.PI / 2);
  if (cosA >  0.2) return 'start';
  if (cosA < -0.2) return 'end';
  return 'middle';
}

// Invisible pie-slice hover zone for each axis
function sectorPath(i: number): string {
  const half = Math.PI / N;
  const angle = (2 * Math.PI * i) / N - Math.PI / 2;
  const a1 = angle - half;
  const a2 = angle + half;
  const r = BG_R;
  const x1 = (CENTER + r * Math.cos(a1)).toFixed(2);
  const y1 = (CENTER + r * Math.sin(a1)).toFixed(2);
  const x2 = (CENTER + r * Math.cos(a2)).toFixed(2);
  const y2 = (CENTER + r * Math.sin(a2)).toFixed(2);
  return `M ${CENTER},${CENTER} L ${x1},${y1} A ${r},${r} 0 0,1 ${x2},${y2} Z`;
}

export function SnowflakeChart({ data }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);

  const ratios = AXES.map(({ key }) => {
    const g = data[key];
    return g.max > 0 ? g.score / g.max : 0;
  });

  const pts  = ratios.map((r, i) => polar(r * MAX_R, i));
  const poly = pts.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');

  const totalScore = AXES.reduce((s, { key }) => s + data[key].score, 0);
  const totalMax   = AXES.reduce((s, { key }) => s + data[key].max, 0);

  const activeLabel = hovered !== null ? AXES[hovered].label : 'TOTAL';
  const activeScore = hovered !== null
    ? `${data[AXES[hovered].key].score}/${data[AXES[hovered].key].max}`
    : `${totalScore}/${totalMax}`;

  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      style={{ display: 'block' }}
    >
      <defs>
        <filter id="sf-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="sf-bg" cx="50%" cy="40%" r="60%">
          <stop offset="0%"   stopColor="#22273d" />
          <stop offset="100%" stopColor={DARK_BG} />
        </radialGradient>
        <radialGradient id="sf-center" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#191c2b" stopOpacity="1" />
          <stop offset="100%" stopColor="#191c2b" stopOpacity="0.6" />
        </radialGradient>
      </defs>

      {/* ── Background circle ── */}
      <circle cx={CENTER} cy={CENTER} r={BG_R} fill="url(#sf-bg)" />
      <circle cx={CENTER} cy={CENTER} r={BG_R} fill="none" stroke={DARK_RING} strokeWidth="2" />

      {/* ── Concentric grid rings ── */}
      {[0.2, 0.4, 0.6, 0.8, 1.0].map(lv => (
        <circle
          key={lv}
          cx={CENTER} cy={CENTER}
          r={lv * MAX_R}
          fill="none"
          stroke={lv === 1.0 ? '#2e3450' : GRID}
          strokeWidth={lv === 1.0 ? 1.5 : 1}
        />
      ))}

      {/* ── Axis spokes ── */}
      {AXES.map((_, i) => {
        const e = polar(MAX_R, i);
        const active = hovered === i;
        return (
          <line key={i}
            x1={CENTER} y1={CENTER}
            x2={e.x}    y2={e.y}
            stroke={active ? SPOKE_HL : GRID}
            strokeWidth={active ? 1.5 : 1}
          />
        );
      })}

      {/* ── Data polygon with glow ── */}
      <polygon
        points={poly}
        fill={LIME_DIM}
        stroke={LIME}
        strokeWidth="2.5"
        strokeLinejoin="round"
        filter="url(#sf-glow)"
        style={{ pointerEvents: 'none' }}
      />

      {/* ── Vertex dots ── */}
      {pts.map((p, i) => (
        <g key={i} style={{ pointerEvents: 'none' }}>
          {hovered === i && (
            <circle cx={p.x} cy={p.y} r="8" fill={LIME} opacity="0.25" />
          )}
          <circle
            cx={p.x} cy={p.y}
            r={hovered === i ? 5 : 3.5}
            fill={LIME}
            stroke={DARK_BG}
            strokeWidth="1.5"
          />
        </g>
      ))}

      {/* ── Axis labels ── */}
      {AXES.map(({ label }, i) => {
        const p = polar(LABEL_R, i);
        const active = hovered === i;
        return (
          <text
            key={i}
            x={p.x} y={p.y}
            textAnchor={labelAnchor(i)}
            dominantBaseline="middle"
            fontSize={active ? '10' : '9'}
            fontWeight="700"
            fill={active ? LIME : 'rgba(255,255,255,0.8)'}
            style={{
              fontFamily: 'system-ui,-apple-system,sans-serif',
              letterSpacing: '0.9px',
              pointerEvents: 'none',
            }}
          >
            {label}
          </text>
        );
      })}

      {/* ── Transparent hover zones (pie slices) ── */}
      {AXES.map((_, i) => (
        <path
          key={i}
          d={sectorPath(i)}
          fill="transparent"
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          style={{ cursor: 'crosshair' }}
        />
      ))}

      {/* ── Center score display ── */}
      <circle cx={CENTER} cy={CENTER} r="28" fill="url(#sf-center)" style={{ pointerEvents: 'none' }} />
      <text
        x={CENTER} y={CENTER - 9}
        textAnchor="middle"
        fontSize="7"
        fontWeight="700"
        fill={hovered !== null ? 'rgba(190,209,42,0.7)' : 'rgba(255,255,255,0.35)'}
        style={{ fontFamily: 'system-ui,-apple-system,sans-serif', letterSpacing: '1px', pointerEvents: 'none' }}
      >
        {activeLabel}
      </text>
      <text
        x={CENTER} y={CENTER + 10}
        textAnchor="middle"
        fontSize="17"
        fontWeight="700"
        fill={hovered !== null ? LIME : 'rgba(255,255,255,0.65)'}
        style={{ fontFamily: 'system-ui,-apple-system,sans-serif', pointerEvents: 'none' }}
      >
        {activeScore}
      </text>
    </svg>
  );
}
