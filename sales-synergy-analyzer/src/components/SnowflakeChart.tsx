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

// BG_R=160 is large enough that all label text (including "DIVIDEND" at end-anchor)
// stays inside the dark circle. Derived from: BG_R > sqrt((LABEL_R*cos+textW)² + (LABEL_R*sin)²)
const SIZE    = 340;
const CENTER  = SIZE / 2;   // 170
const MAX_R   = 90;         // outermost grid ring
const BG_R    = 160;        // dark circle radius
const LABEL_R = 114;        // label orbit — well inside BG_R
const N       = AXES.length;

const LIME      = '#bed12a';
const LIME_DIM  = 'rgba(190,209,42,0.80)';
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

function sectorPath(i: number): string {
  const half = Math.PI / N;
  const a = (2 * Math.PI * i) / N - Math.PI / 2;
  const a1 = a - half;
  const a2 = a + half;
  const x1 = (CENTER + BG_R * Math.cos(a1)).toFixed(2);
  const y1 = (CENTER + BG_R * Math.sin(a1)).toFixed(2);
  const x2 = (CENTER + BG_R * Math.cos(a2)).toFixed(2);
  const y2 = (CENTER + BG_R * Math.sin(a2)).toFixed(2);
  return `M ${CENTER},${CENTER} L ${x1},${y1} A ${BG_R},${BG_R} 0 0,1 ${x2},${y2} Z`;
}

export function SnowflakeChart({ data }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);

  const ratios = AXES.map(({ key }) => {
    const g = data[key];
    return g.max > 0 ? g.score / g.max : 0;
  });

  const pts  = ratios.map((r, i) => polar(r * MAX_R, i));
  const poly = pts.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');

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
      </defs>

      {/* ── Dark circular background ── */}
      <circle cx={CENTER} cy={CENTER} r={BG_R} fill="url(#sf-bg)" />
      <circle cx={CENTER} cy={CENTER} r={BG_R} fill="none" stroke={DARK_RING} strokeWidth="2" />

      {/* ── Hovered sector: subtle lime tint ── */}
      {hovered !== null && (
        <path
          d={sectorPath(hovered)}
          fill="rgba(190,209,42,0.06)"
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* ── Concentric grid rings ── */}
      {[0.2, 0.4, 0.6, 0.8, 1.0].map(lv => (
        <circle key={lv} cx={CENTER} cy={CENTER} r={lv * MAX_R}
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
            x1={CENTER} y1={CENTER} x2={e.x} y2={e.y}
            stroke={active ? SPOKE_HL : GRID}
            strokeWidth={active ? 2 : 1}
          />
        );
      })}

      {/* ── Data polygon with lime glow ── */}
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
            <circle cx={p.x} cy={p.y} r="9" fill={LIME} opacity="0.22" />
          )}
          <circle
            cx={p.x} cy={p.y}
            r={hovered === i ? 5 : 3.5}
            fill={LIME} stroke={DARK_BG} strokeWidth="1.5"
          />
        </g>
      ))}

      {/* ── Transparent hover zones (pie slices over full circle) ── */}
      {AXES.map((_, i) => (
        <path key={i}
          d={sectorPath(i)}
          fill="transparent"
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          style={{ cursor: 'crosshair' }}
        />
      ))}

      {/* ── Axis labels: shift up + show score below on hover ── */}
      {AXES.map(({ label }, i) => {
        const p   = polar(LABEL_R, i);
        const anc = labelAnchor(i);
        const act = hovered === i;
        const g   = data[AXES[i].key];
        return (
          <g key={i} style={{ pointerEvents: 'none' }}>
            <text
              x={p.x}
              y={act ? p.y - 7 : p.y}
              textAnchor={anc}
              dominantBaseline="middle"
              fontSize="9"
              fontWeight="700"
              fill={act ? LIME : 'rgba(255,255,255,0.82)'}
              style={{ fontFamily: 'system-ui,-apple-system,sans-serif', letterSpacing: '0.9px' }}
            >
              {label}
            </text>
            {act && (
              <text
                x={p.x}
                y={p.y + 7}
                textAnchor={anc}
                dominantBaseline="middle"
                fontSize="10"
                fontWeight="700"
                fill={LIME}
                style={{ fontFamily: 'system-ui,-apple-system,sans-serif' }}
              >
                {g.score}/{g.max}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
