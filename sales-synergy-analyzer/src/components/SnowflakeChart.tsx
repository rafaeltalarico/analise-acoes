import { useState, useMemo, useId } from 'react';
import type { SnowflakeAnalysis } from '../types/stock';

// ─────────────────────────────────────────────────────────────────────────────
// § Geometry — every measurement derived from SIZE so proportions are stable
// ─────────────────────────────────────────────────────────────────────────────

const N    = 5;
const SIZE = 300;                    // logical viewBox dimension
const CX   = SIZE / 2;              // 150
const CY   = SIZE / 2;              // 150
const HALF = SIZE / 2;              // 150

// Radii as fractions of HALF — change one number, everything re-scales
const BG_R    = HALF * 0.920;       // 138 — dark circle (fills most of SVG)
const MAX_R   = HALF * 0.520;       // 78  — outermost grid ring
const LABEL_R = HALF * 0.633;       // 95  — label orbit (fits inside BG_R for all labels)

// ─────────────────────────────────────────────────────────────────────────────
// § SWS-inspired palette
// ─────────────────────────────────────────────────────────────────────────────
const C_BG_IN   = '#1e2337';
const C_BG_OUT  = '#12151f';
const C_RING    = '#3a4060';        // outer circle stroke — lighter = more visible
const C_GRID    = '#283050';        // concentric rings
const C_SPOKE   = '#1e2440';        // radial lines — subtle
const C_LIME    = '#b8d41a';        // SWS lime
const C_LIME_F  = 'rgba(184,212,26,0.88)';
const C_HL_SPK  = '#505a7a';        // spoke highlight on hover

// ─────────────────────────────────────────────────────────────────────────────
// § Geometry helpers (separated from rendering)
// ─────────────────────────────────────────────────────────────────────────────
type Pt = { x: number; y: number };

function axisAngle(i: number) {
  return (2 * Math.PI * i) / N - Math.PI / 2;
}

function polar(r: number, i: number): Pt {
  const a = axisAngle(i);
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
}

function anchor(i: number): 'start' | 'middle' | 'end' {
  const c = Math.cos(axisAngle(i));
  return c > 0.2 ? 'start' : c < -0.2 ? 'end' : 'middle';
}

// Pie-slice hover zone spanning from center to BG_R
function sectorD(i: number): string {
  const half = Math.PI / N;
  const a    = axisAngle(i);
  const a1   = a - half;
  const a2   = a + half;
  const x1   = (CX + BG_R * Math.cos(a1)).toFixed(2);
  const y1   = (CY + BG_R * Math.sin(a1)).toFixed(2);
  const x2   = (CX + BG_R * Math.cos(a2)).toFixed(2);
  const y2   = (CY + BG_R * Math.sin(a2)).toFixed(2);
  return `M ${CX},${CY} L ${x1},${y1} A ${BG_R},${BG_R} 0 0,1 ${x2},${y2} Z`;
}

// Catmull-Rom closed → cubic-bezier path (smooth polygon corners)
function catmullRomClosed(pts: Pt[], tension = 0.38): string {
  const n  = pts.length;
  const p  = (k: number) => pts[((k % n) + n) % n];
  const t  = tension / 3;
  let d = `M ${p(0).x.toFixed(2)},${p(0).y.toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) * t;
    const cp1y = p1.y + (p2.y - p0.y) * t;
    const cp2x = p2.x - (p3.x - p1.x) * t;
    const cp2y = p2.y - (p3.y - p1.y) * t;
    d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d + ' Z';
}

// ─────────────────────────────────────────────────────────────────────────────
// § Component
// ─────────────────────────────────────────────────────────────────────────────
const AXES = [
  { key: 'value'    as const, label: 'VALUE'    },
  { key: 'future'   as const, label: 'FUTURE'   },
  { key: 'past'     as const, label: 'PAST'     },
  { key: 'health'   as const, label: 'HEALTH'   },
  { key: 'dividend' as const, label: 'DIVIDEND' },
];

interface Props { data: SnowflakeAnalysis }

export function SnowflakeChart({ data }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const id = useId().replace(/:/g, '');   // safe for SVG IDs

  // Geometry computed once; key changes → animation replays
  const { pts, pathD, animKey } = useMemo(() => {
    const pts   = AXES.map(({ key }, i) => {
      const g     = data[key];
      const ratio = g.max > 0 ? g.score / g.max : 0;
      return polar(ratio * MAX_R, i);
    });
    const pathD   = catmullRomClosed(pts);
    const animKey = AXES.map(({ key }) => data[key].score).join('-');
    return { pts, pathD, animKey };
  }, [data]);

  const clipId   = `clip-${id}`;
  const bgGradId = `bg-${id}`;
  const shadowId = `shadow-${id}`;
  const glowId   = `glow-${id}`;
  const animPoly = `anim-poly-${id}`;
  const animDot  = `anim-dot-${id}`;

  return (
    // Responsive: SVG fills container width, maintains 1:1 aspect ratio
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width="100%"
      style={{ display: 'block', aspectRatio: '1 / 1' }}
      aria-label="Snowflake analysis radar chart"
    >
      <defs>
        {/* ── Entrance animations ── */}
        <style>{`
          @keyframes ${animPoly} {
            from { opacity: 0; transform: scale(0.6); }
            to   { opacity: 1; transform: scale(1);   }
          }
          @keyframes ${animDot} {
            from { opacity: 0; transform: scale(0);   }
            to   { opacity: 1; transform: scale(1);   }
          }
          .poly-${id} {
            transform-origin: ${CX}px ${CY}px;
            animation: ${animPoly} 0.55s cubic-bezier(0.34,1.56,0.64,1) both;
          }
          .dot-${id} {
            animation: ${animDot} 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.15s both;
          }
        `}</style>

        {/* Radial gradient: off-center highlight creates depth */}
        <radialGradient id={bgGradId} cx="40%" cy="30%" r="70%">
          <stop offset="0%"   stopColor={C_BG_IN} />
          <stop offset="100%" stopColor={C_BG_OUT} />
        </radialGradient>

        {/* Drop-shadow for background circle */}
        <filter id={shadowId} x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="6" stdDeviation="10"
            floodColor="#000" floodOpacity="0.55" />
        </filter>

        {/* Soft glow for data polygon */}
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Clip-path: limits grid/polygon/dots to inside the dark circle */}
        <clipPath id={clipId}>
          <circle cx={CX} cy={CY} r={BG_R - 0.5} />
        </clipPath>
      </defs>

      {/* ── 1. Background circle ── */}
      <circle
        cx={CX} cy={CY} r={BG_R}
        fill={`url(#${bgGradId})`}
        filter={`url(#${shadowId})`}
      />
      <circle cx={CX} cy={CY} r={BG_R}
        fill="none" stroke={C_RING} strokeWidth="1.5" />

      {/* ── 2. Clipped data area (grid + polygon + dots) ── */}
      <g clipPath={`url(#${clipId})`}>

        {/* Sector highlight on hover */}
        {hovered !== null && (
          <path d={sectorD(hovered)} fill="rgba(184,212,26,0.06)" />
        )}

        {/* Concentric rings — dashed inner rings, solid outer */}
        {[0.25, 0.5, 0.75, 1.0].map(lv => (
          <circle key={lv}
            cx={CX} cy={CY} r={lv * MAX_R}
            fill="none"
            stroke={lv === 1.0 ? '#30385a' : C_GRID}
            strokeWidth={lv === 1.0 ? 1.2 : 0.7}
            strokeDasharray={lv < 1.0 ? '2.5 4' : undefined}
            opacity={lv === 1.0 ? 1 : 0.7}
          />
        ))}

        {/* Radial spokes */}
        {AXES.map((_, i) => {
          const e  = polar(MAX_R, i);
          const hl = hovered === i;
          return (
            <line key={i}
              x1={CX} y1={CY} x2={e.x} y2={e.y}
              stroke={hl ? C_HL_SPK : C_SPOKE}
              strokeWidth={hl ? 1.1 : 0.7}
              opacity={hl ? 0.8 : 0.45}
            />
          );
        })}

        {/* Data path — Catmull-Rom smooth shape; key triggers re-animation */}
        <path
          key={`poly-${animKey}`}
          className={`poly-${id}`}
          d={pathD}
          fill={C_LIME_F}
          stroke={C_LIME}
          strokeWidth="1.6"
          strokeLinejoin="round"
          filter={`url(#${glowId})`}
        />

        {/* Vertex dots */}
        {pts.map((p, i) => (
          <g key={`dot-${i}-${animKey}`}
            className={`dot-${id}`}
            style={{ transformOrigin: `${p.x}px ${p.y}px` }}
          >
            {hovered === i && (
              <circle cx={p.x} cy={p.y} r="5.5" fill={C_LIME} opacity="0.18" />
            )}
            <circle
              cx={p.x} cy={p.y}
              r={hovered === i ? 3 : 2}
              fill={C_LIME}
              stroke={C_BG_OUT}
              strokeWidth="0.8"
            />
          </g>
        ))}
      </g>

      {/* ── 3. Invisible hover zones (outside clip so full sector is interactive) ── */}
      {AXES.map((_, i) => (
        <path key={i}
          d={sectorD(i)}
          fill="transparent"
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          style={{ cursor: 'crosshair' }}
        />
      ))}

      {/* ── 4. Labels — outside clip so they're never truncated ── */}
      {AXES.map(({ label }, i) => {
        const p   = polar(LABEL_R, i);
        const anc = anchor(i);
        const act = hovered === i;
        const g   = data[AXES[i].key];
        return (
          <g key={i} style={{ pointerEvents: 'none' }}>
            <text
              x={p.x} y={act ? p.y - 6 : p.y}
              textAnchor={anc}
              dominantBaseline="middle"
              fontSize="8"
              fontWeight="700"
              fill={act ? C_LIME : 'rgba(255,255,255,0.75)'}
              style={{
                fontFamily: '"Inter",system-ui,-apple-system,sans-serif',
                letterSpacing: '1px',
              }}
            >
              {label}
            </text>
            {act && (
              <text
                x={p.x} y={p.y + 7}
                textAnchor={anc}
                dominantBaseline="middle"
                fontSize="9.5"
                fontWeight="700"
                fill={C_LIME}
                style={{ fontFamily: '"Inter",system-ui,-apple-system,sans-serif' }}
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
