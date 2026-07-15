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

const SIZE    = 300;
const CENTER  = SIZE / 2;
const MAX_R   = 88;
const BG_R    = 122;
const LABEL_R = 108;
const N       = AXES.length;

const LIME      = '#bed12a';
const LIME_FILL = 'rgba(190,209,42,0.82)';
const DARK_BG   = '#191c2b';
const DARK_RING = '#363b55';
const GRID      = '#252a3d';

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

export function SnowflakeChart({ data }: Props) {
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
      overflow="visible"
      style={{ display: 'block' }}
    >
      <defs>
        <filter id="sf-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="sf-bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#1f2338" />
          <stop offset="100%" stopColor={DARK_BG} />
        </radialGradient>
      </defs>

      {/* Dark circular background with radial gradient */}
      <circle cx={CENTER} cy={CENTER} r={BG_R} fill="url(#sf-bg)" />
      <circle cx={CENTER} cy={CENTER} r={BG_R} fill="none" stroke={DARK_RING} strokeWidth="2" />

      {/* Concentric grid rings */}
      {[0.2, 0.4, 0.6, 0.8, 1.0].map(lv => (
        <circle
          key={lv}
          cx={CENTER} cy={CENTER}
          r={lv * MAX_R}
          fill="none"
          stroke={GRID}
          strokeWidth={lv === 1.0 ? 1.5 : 1}
        />
      ))}

      {/* Axis spokes */}
      {AXES.map((_, i) => {
        const e = polar(MAX_R, i);
        return (
          <line key={i}
            x1={CENTER} y1={CENTER}
            x2={e.x}    y2={e.y}
            stroke={GRID} strokeWidth="1"
          />
        );
      })}

      {/* Data polygon with lime glow */}
      <polygon
        points={poly}
        fill={LIME_FILL}
        stroke={LIME}
        strokeWidth="2.5"
        strokeLinejoin="round"
        filter="url(#sf-glow)"
      />

      {/* Vertex dots */}
      {pts.map((p, i) => (
        <circle
          key={i}
          cx={p.x} cy={p.y}
          r="3.5"
          fill={LIME}
          stroke={DARK_BG}
          strokeWidth="1.5"
        />
      ))}

      {/* Axis labels */}
      {AXES.map(({ label }, i) => {
        const p = polar(LABEL_R, i);
        return (
          <text
            key={i}
            x={p.x} y={p.y}
            textAnchor={labelAnchor(i)}
            dominantBaseline="middle"
            fontSize="9"
            fontWeight="700"
            fill="rgba(255,255,255,0.92)"
            style={{
              fontFamily: 'system-ui,-apple-system,sans-serif',
              letterSpacing: '0.8px',
            }}
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}
