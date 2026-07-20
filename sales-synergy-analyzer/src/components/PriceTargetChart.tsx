import { useMemo } from 'react';
import type { HistoryPoint, PriceTarget } from '../types/stock';

// ─────────────────────────────────────────────────────────────────────────────
// § Layout constants
// ─────────────────────────────────────────────────────────────────────────────
const W      = 700;
const H      = 320;
const PAD_L  = 58;
const PAD_R  = 20;
const PAD_T  = 20;
const PAD_B  = 38;
const CHART_W = W - PAD_L - PAD_R;
const CHART_H = H - PAD_T - PAD_B;

// ─────────────────────────────────────────────────────────────────────────────
// § Palette
// ─────────────────────────────────────────────────────────────────────────────
const C_BG      = '#131722';
const C_GRID    = 'rgba(255,255,255,0.07)';
const C_AXIS    = 'rgba(255,255,255,0.25)';
const C_LABEL   = 'rgba(255,255,255,0.45)';
const C_HIST    = '#26a69a';
const C_DIVIDER = 'rgba(255,255,255,0.35)';
const C_HIGH    = '#ef5350';
const C_MEAN    = '#ffc107';
const C_LOW     = '#42a5f5';

const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

interface Props {
  ticker: string;
  history: HistoryPoint[];
  priceTarget: PriceTarget;
}

function monthLabel(date: Date) {
  return MONTHS_PT[date.getMonth()];
}

export function PriceTargetChart({ ticker, history, priceTarget }: Props) {
  const { histPts, forecastPts, xLabels, yTicks, todayX } = useMemo(() => {
    const today = new Date();

    // ── Historical points (sorted) ──────────────────────────────────────────
    const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));

    // Build forecast anchor: 12 months from today
    const forecastEnd = new Date(today);
    forecastEnd.setFullYear(forecastEnd.getFullYear() + 1);

    // Time span: earliest historical date → forecast end
    const t0 = sorted.length > 0 ? new Date(sorted[0].date).getTime() : today.getTime();
    const t1 = forecastEnd.getTime();
    const tSpan = t1 - t0 || 1;

    const toX = (t: number) => PAD_L + ((t - t0) / tSpan) * CHART_W;

    // ── Price range (all values) ────────────────────────────────────────────
    const allPrices = sorted.map(p => p.close);
    const targets = [priceTarget.current, priceTarget.low, priceTarget.mean, priceTarget.high]
      .filter((v): v is number => v != null);
    allPrices.push(...targets);

    const minP = Math.min(...allPrices) * 0.95;
    const maxP = Math.max(...allPrices) * 1.05;
    const pSpan = maxP - minP || 1;

    const toY = (p: number) => PAD_T + CHART_H - ((p - minP) / pSpan) * CHART_H;

    // ── Historical SVG points ───────────────────────────────────────────────
    const histPts = sorted.map(p => ({
      x: toX(new Date(p.date).getTime()),
      y: toY(p.close),
    }));

    // ── todayX ─────────────────────────────────────────────────────────────
    const todayX = toX(today.getTime());
    const currentY = toY(priceTarget.current ?? (sorted.at(-1)?.close ?? 0));

    // ── Forecast points (from today → 12 months) ───────────────────────────
    const forecastEndX = toX(forecastEnd.getTime());
    const forecastPts = [
      { label: 'High', color: C_HIGH, value: priceTarget.high, y: priceTarget.high != null ? toY(priceTarget.high) : null },
      { label: 'Mean', color: C_MEAN, value: priceTarget.mean, y: priceTarget.mean != null ? toY(priceTarget.mean) : null },
      { label: 'Low',  color: C_LOW,  value: priceTarget.low,  y: priceTarget.low  != null ? toY(priceTarget.low)  : null },
    ].map(fp => ({ ...fp, x1: todayX, y1: currentY, x2: forecastEndX }));

    // ── X-axis labels (every 2 months across full span) ────────────────────
    const xLabels: { x: number; label: string }[] = [];
    const cur = new Date(t0);
    cur.setDate(1);
    while (cur.getTime() <= t1) {
      const x = toX(cur.getTime());
      if (x >= PAD_L - 5 && x <= PAD_L + CHART_W + 5) {
        const isJan = cur.getMonth() === 0;
        xLabels.push({
          x,
          label: isJan ? `${monthLabel(cur)} ${cur.getFullYear()}` : monthLabel(cur),
        });
      }
      cur.setMonth(cur.getMonth() + 2);
    }

    // ── Y-axis ticks (5 levels) ─────────────────────────────────────────────
    const step = (maxP - minP) / 4;
    const yTicks = Array.from({ length: 5 }, (_, i) => {
      const price = minP + step * i;
      return { y: toY(price), label: `$${price >= 1000 ? price.toFixed(0) : price.toFixed(2)}` };
    });

    return { histPts, forecastPts, xLabels, yTicks, todayX, currentY };
  }, [history, priceTarget]);

  // ── Polyline string for historical path ────────────────────────────────────
  const histLine = histPts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const hasHistory = histPts.length > 1;
  const hasTargets = forecastPts.some(fp => fp.value != null);

  return (
    <div style={{ background: C_BG, borderRadius: 12, padding: '16px 4px 8px', overflow: 'hidden' }}>
      {/* Title row */}
      <div style={{ padding: '0 16px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, letterSpacing: '0.5px' }}>
            {ticker} STOCK PRICE TARGET
          </div>
          <div style={{ color: C_LABEL, fontSize: 10, marginTop: 2, letterSpacing: '0.5px' }}>
            PAST 12 MONTHS WITH 12 MONTHS FORECAST
          </div>
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {[
            { color: C_HIST, label: 'Price' },
            { color: C_HIGH, label: 'High' },
            { color: C_MEAN, label: 'Mean' },
            { color: C_LOW,  label: 'Low'  },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 20, height: 2, background: color, borderRadius: 1 }} />
              <span style={{ color: C_LABEL, fontSize: 9, letterSpacing: '0.4px' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: 'block', aspectRatio: `${W} / ${H}` }}
        aria-label="Price target forecast chart"
      >
        {/* Grid lines (horizontal) */}
        {yTicks.map((t, i) => (
          <line key={i}
            x1={PAD_L} y1={t.y} x2={PAD_L + CHART_W} y2={t.y}
            stroke={C_GRID} strokeWidth="0.8"
          />
        ))}

        {/* Y-axis labels */}
        {yTicks.map((t, i) => (
          <text key={i}
            x={PAD_L - 6} y={t.y}
            textAnchor="end" dominantBaseline="middle"
            fontSize="9" fill={C_LABEL}
            style={{ fontFamily: 'system-ui, sans-serif' }}
          >
            {t.label}
          </text>
        ))}

        {/* X-axis labels */}
        {xLabels.map((l, i) => (
          <text key={i}
            x={l.x} y={H - PAD_B + 14}
            textAnchor="middle" fontSize="8.5" fill={C_LABEL}
            style={{ fontFamily: 'system-ui, sans-serif' }}
          >
            {l.label}
          </text>
        ))}

        {/* Axes */}
        <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + CHART_H} stroke={C_AXIS} strokeWidth="0.8" />
        <line x1={PAD_L} y1={PAD_T + CHART_H} x2={PAD_L + CHART_W} y2={PAD_T + CHART_H} stroke={C_AXIS} strokeWidth="0.8" />

        {/* Historical price line */}
        {hasHistory && (
          <polyline
            points={histLine}
            fill="none"
            stroke={C_HIST}
            strokeWidth="1.8"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Today divider */}
        <line
          x1={todayX} y1={PAD_T}
          x2={todayX} y2={PAD_T + CHART_H}
          stroke={C_DIVIDER}
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <text
          x={todayX + 4} y={PAD_T + 8}
          fontSize="8" fill={C_DIVIDER}
          style={{ fontFamily: 'system-ui, sans-serif' }}
        >
          Hoje
        </text>

        {/* Forecast lines */}
        {hasTargets && forecastPts.map(fp => {
          if (fp.value == null || fp.y == null) return null;
          return (
            <g key={fp.label}>
              <line
                x1={fp.x1} y1={fp.y1}
                x2={fp.x2} y2={fp.y}
                stroke={fp.color}
                strokeWidth="1.4"
                strokeDasharray="6 4"
                strokeLinecap="round"
              />
              {/* Endpoint dot */}
              <circle cx={fp.x2} cy={fp.y} r="3.5" fill={fp.color} opacity="0.9" />
              {/* Label */}
              <text
                x={fp.x2 + 5} y={fp.y}
                dominantBaseline="middle"
                fontSize="8.5"
                fill={fp.color}
                style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 600 }}
              >
                ${fp.value.toFixed(2)}
              </text>
            </g>
          );
        })}

        {/* Current price dot (junction of history and forecast) */}
        {hasHistory && (
          <circle
            cx={histPts.at(-1)?.x ?? todayX}
            cy={histPts.at(-1)?.y ?? 0}
            r="3"
            fill={C_HIST}
            stroke={C_BG}
            strokeWidth="1.5"
          />
        )}
      </svg>
    </div>
  );
}
