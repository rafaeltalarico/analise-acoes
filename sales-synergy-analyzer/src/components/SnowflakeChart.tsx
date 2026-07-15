import type { SnowflakeAnalysis } from '../types/stock';

interface Props {
  data: SnowflakeAnalysis;
}

const AXES = [
  { key: 'value' as const,    label: 'Valor' },
  { key: 'future' as const,   label: 'Futuro' },
  { key: 'past' as const,     label: 'Passado' },
  { key: 'health' as const,   label: 'Saúde' },
  { key: 'dividend' as const, label: 'Dividendo' },
];

const SIZE = 240;
const CENTER = SIZE / 2;
const MAX_RADIUS = 85;
const LABEL_RADIUS = 108;
const N = 5;

function polar(r: number, i: number) {
  const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
  return { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle) };
}

function polygon(r: number) {
  return Array.from({ length: N }, (_, i) => {
    const p = polar(r, i);
    return `${p.x},${p.y}`;
  }).join(' ');
}

export function SnowflakeChart({ data }: Props) {
  const scores = AXES.map(({ key }) => {
    const g = data[key];
    return g.max > 0 ? g.score / g.max : 0;
  });

  const dataPolygon = scores
    .map((ratio, i) => {
      const p = polar(ratio * MAX_RADIUS, i);
      return `${p.x},${p.y}`;
    })
    .join(' ');

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {[0.2, 0.4, 0.6, 0.8, 1.0].map(level => (
          <polygon
            key={level}
            points={polygon(level * MAX_RADIUS)}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="1"
          />
        ))}

        {AXES.map((_, i) => {
          const end = polar(MAX_RADIUS, i);
          return (
            <line key={i} x1={CENTER} y1={CENTER} x2={end.x} y2={end.y} stroke="#e5e7eb" strokeWidth="1" />
          );
        })}

        <polygon
          points={dataPolygon}
          fill="rgba(59,130,246,0.20)"
          stroke="#3b82f6"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {scores.map((ratio, i) => {
          const p = polar(ratio * MAX_RADIUS, i);
          return <circle key={i} cx={p.x} cy={p.y} r="4" fill="#3b82f6" />;
        })}

        {AXES.map(({ label, key }, i) => {
          const p = polar(LABEL_RADIUS, i);
          const g = data[key];
          return (
            <g key={i}>
              <text x={p.x} y={p.y - 4} textAnchor="middle" fontSize="10" fontWeight="600" fill="#374151">
                {label}
              </text>
              <text x={p.x} y={p.y + 9} textAnchor="middle" fontSize="9" fill="#6b7280">
                {g.score}/{g.max}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-gray-500">
        {AXES.map(({ key, label }) => {
          const g = data[key];
          const pct = g.max > 0 ? Math.round((g.score / g.max) * 100) : 0;
          return (
            <span key={key}>
              <span className="font-medium text-gray-700">{label}:</span> {g.score}/{g.max} ({pct}%)
            </span>
          );
        })}
      </div>
    </div>
  );
}
