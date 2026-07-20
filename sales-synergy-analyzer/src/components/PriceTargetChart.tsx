import { useMemo, useState, useRef, useCallback } from 'react';
import type { HistoryPoint, PriceTarget } from '../types/stock';

// ─────────────────────────────────────────────────────────────────────────────
// § Layout
// ─────────────────────────────────────────────────────────────────────────────
const W       = 700;
const H       = 320;
const PAD_L   = 58;
const PAD_R   = 68;   // wide enough for endpoint price labels
const PAD_T   = 20;
const PAD_B   = 38;
const CHART_W = W - PAD_L - PAD_R;
const CHART_H = H - PAD_T - PAD_B;

// ─────────────────────────────────────────────────────────────────────────────
// § Palette
// ─────────────────────────────────────────────────────────────────────────────
const C_BG      = '#131722';
const C_GRID    = 'rgba(255,255,255,0.07)';
const C_AXIS    = 'rgba(255,255,255,0.22)';
const C_LABEL   = 'rgba(255,255,255,0.42)';
const C_HIST    = '#26a69a';
const C_DIVIDER = 'rgba(255,255,255,0.32)';
const C_HIGH    = '#ef5350';
const C_MEAN    = '#ffc107';
const C_LOW     = '#42a5f5';
const C_TT_BG   = 'rgba(16,20,34,0.97)';
const C_TT_BD   = 'rgba(255,255,255,0.12)';

const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const TT_W = 140;

// ─────────────────────────────────────────────────────────────────────────────
// § Types
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  ticker: string;
  history: HistoryPoint[];
  priceTarget: PriceTarget;
}

interface HistPt { x: number; y: number; date: string; close: number; }

interface HoverState {
  svgX: number;
  svgY: number;
  dateLabel: string;
  price: number | null;
  isForecast: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// § Component
// ─────────────────────────────────────────────────────────────────────────────
export function PriceTargetChart({ ticker, history, priceTarget }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<HoverState | null>(null);

  // ── Derived geometry ───────────────────────────────────────────────────────
  const {
    histPts, forecastPts, xLabels, yTicks, todayX, t0, tSpan, currentPrice,
  } = useMemo(() => {
    const today = new Date();
    const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));

    const forecastEnd = new Date(today);
    forecastEnd.setFullYear(forecastEnd.getFullYear() + 1);

    const t0     = sorted.length > 0 ? new Date(sorted[0].date).getTime() : today.getTime();
    const t1     = forecastEnd.getTime();
    const tSpan  = t1 - t0 || 1;
    const toX    = (t: number) => PAD_L + ((t - t0) / tSpan) * CHART_W;

    const allPrices = sorted.map(p => p.close);
    const targets = [priceTarget.current, priceTarget.low, priceTarget.mean, priceTarget.high]
      .filter((v): v is number => v != null);
    allPrices.push(...targets);

    const minP  = Math.min(...allPrices) * 0.95;
    const maxP  = Math.max(...allPrices) * 1.05;
    const pSpan = maxP - minP || 1;
    const toY   = (p: number) => PAD_T + CHART_H - ((p - minP) / pSpan) * CHART_H;

    const histPts: HistPt[] = sorted.map(p => ({
      x: toX(new Date(p.date).getTime()),
      y: toY(p.close),
      date: p.date,
      close: p.close,
    }));

    const todayX       = toX(today.getTime());
    const currentPrice = priceTarget.current ?? sorted.at(-1)?.close ?? 0;
    const currentY     = toY(currentPrice);
    const forecastEndX = toX(forecastEnd.getTime());

    const forecastPts = [
      { label: 'High', color: C_HIGH, value: priceTarget.high, y: priceTarget.high != null ? toY(priceTarget.high) : null },
      { label: 'Mean', color: C_MEAN, value: priceTarget.mean, y: priceTarget.mean != null ? toY(priceTarget.mean) : null },
      { label: 'Low',  color: C_LOW,  value: priceTarget.low,  y: priceTarget.low  != null ? toY(priceTarget.low)  : null },
    ].map(fp => ({ ...fp, x1: todayX, y1: currentY, x2: forecastEndX }));

    // X labels every 2 months across the full span
    const xLabels: { x: number; label: string }[] = [];
    const cur = new Date(t0);
    cur.setDate(1);
    while (cur.getTime() <= t1) {
      const x = toX(cur.getTime());
      if (x >= PAD_L - 4 && x <= PAD_L + CHART_W + 4) {
        xLabels.push({
          x,
          label: cur.getMonth() === 0
            ? `${MONTHS_PT[cur.getMonth()]} ${cur.getFullYear()}`
            : MONTHS_PT[cur.getMonth()],
        });
      }
      cur.setMonth(cur.getMonth() + 2);
    }

    const step   = (maxP - minP) / 4;
    const yTicks = Array.from({ length: 5 }, (_, i) => {
      const price = minP + step * i;
      return { y: toY(price), label: `$${price >= 1000 ? price.toFixed(0) : price.toFixed(2)}` };
    });

    return { histPts, forecastPts, xLabels, yTicks, todayX, t0, tSpan, currentPrice };
  }, [history, priceTarget]);

  // ── Mouse handling ─────────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;

    if (svgX < PAD_L || svgX > PAD_L + CHART_W) { setHover(null); return; }

    if (svgX < todayX) {
      // History area: snap to closest data point
      let closest: HistPt | null = null;
      let minDist = Infinity;
      for (const p of histPts) {
        const d = Math.abs(p.x - svgX);
        if (d < minDist) { minDist = d; closest = p; }
      }
      if (closest) {
        const d = new Date(closest.date);
        setHover({
          svgX: closest.x,
          svgY: closest.y,
          dateLabel: `${d.getDate()} ${MONTHS_PT[d.getMonth()]} ${d.getFullYear()}`,
          price: closest.close,
          isForecast: false,
        });
      }
    } else {
      // Forecast area: show targets
      const t = t0 + ((svgX - PAD_L) / CHART_W) * tSpan;
      const d = new Date(t);
      setHover({
        svgX,
        svgY: 0,
        dateLabel: `${d.getDate()} ${MONTHS_PT[d.getMonth()]} ${d.getFullYear()}`,
        price: currentPrice,
        isForecast: true,
      });
    }
  }, [histPts, todayX, t0, tSpan, currentPrice]);

  const handleMouseLeave = useCallback(() => setHover(null), []);

  // ── Render helpers ─────────────────────────────────────────────────────────
  const histLine   = histPts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const hasHistory = histPts.length > 1;
  const hasTargets = forecastPts.some(fp => fp.value != null);

  // Tooltip layout
  const visibleRows = hover?.isForecast
    ? [priceTarget.high, priceTarget.mean, priceTarget.low].filter(v => v != null).length
    : 1;
  const TT_H = 22 + visibleRows * 18;
  // Keep tooltip inside chart area (flip left when near right edge)
  const ttX = hover ? (hover.svgX + 12 + TT_W > PAD_L + CHART_W ? hover.svgX - TT_W - 10 : hover.svgX + 12) : 0;
  const ttY = PAD_T + 10;

  return (
    <div style={{ background: C_BG, borderRadius: 12, padding: '16px 4px 8px', overflow: 'visible' }}>
      {/* Title row */}
      <div style={{ padding: '0 16px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, letterSpacing: '0.5px' }}>
            {ticker} STOCK PRICE TARGET
          </div>
          <div style={{ color: C_LABEL, fontSize: 10, marginTop: 2, letterSpacing: '0.5px' }}>
            PAST 12 MONTHS WITH 12 MONTHS FORECAST
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {([
            { color: C_HIST, label: 'Price' },
            { color: C_HIGH, label: 'High' },
            { color: C_MEAN, label: 'Mean' },
            { color: C_LOW,  label: 'Low'  },
          ] as const).map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 20, height: 2, background: color, borderRadius: 1 }} />
              <span style={{ color: C_LABEL, fontSize: 9, letterSpacing: '0.4px' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: 'block', aspectRatio: `${W} / ${H}`, cursor: 'crosshair', overflow: 'visible' }}
        aria-label="Price target forecast chart"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Horizontal grid + Y labels */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD_L} y1={t.y} x2={PAD_L + CHART_W} y2={t.y}
              stroke={C_GRID} strokeWidth="0.8" />
            <text x={PAD_L - 6} y={t.y}
              textAnchor="end" dominantBaseline="middle"
              fontSize="9" fill={C_LABEL}
              style={{ fontFamily: 'system-ui, sans-serif' }}>
              {t.label}
            </text>
          </g>
        ))}

        {/* X labels */}
        {xLabels.map((l, i) => (
          <text key={i} x={l.x} y={H - PAD_B + 14}
            textAnchor="middle" fontSize="8.5" fill={C_LABEL}
            style={{ fontFamily: 'system-ui, sans-serif' }}>
            {l.label}
          </text>
        ))}

        {/* Axes */}
        <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + CHART_H} stroke={C_AXIS} strokeWidth="0.8" />
        <line x1={PAD_L} y1={PAD_T + CHART_H} x2={PAD_L + CHART_W} y2={PAD_T + CHART_H} stroke={C_AXIS} strokeWidth="0.8" />

        {/* Historical price line */}
        {hasHistory && (
          <polyline points={histLine} fill="none"
            stroke={C_HIST} strokeWidth="1.8"
            strokeLinejoin="round" strokeLinecap="round" />
        )}

        {/* Today divider */}
        <line x1={todayX} y1={PAD_T} x2={todayX} y2={PAD_T + CHART_H}
          stroke={C_DIVIDER} strokeWidth="1" strokeDasharray="4 4" />
        <text x={todayX + 4} y={PAD_T + 9} fontSize="8" fill={C_DIVIDER}
          style={{ fontFamily: 'system-ui, sans-serif' }}>
          Hoje
        </text>

        {/* Forecast lines */}
        {hasTargets && forecastPts.map(fp => {
          if (fp.value == null || fp.y == null) return null;
          return (
            <g key={fp.label}>
              <line x1={fp.x1} y1={fp.y1} x2={fp.x2} y2={fp.y}
                stroke={fp.color} strokeWidth="1.5"
                strokeDasharray="6 4" strokeLinecap="round" />
              <circle cx={fp.x2} cy={fp.y} r="3.5" fill={fp.color} />
              <text x={fp.x2 + 7} y={fp.y} dominantBaseline="middle"
                fontSize="9" fill={fp.color}
                style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 600 }}>
                ${fp.value.toFixed(2)}
              </text>
            </g>
          );
        })}

        {/* Last-history dot (junction) */}
        {hasHistory && (
          <circle cx={histPts.at(-1)!.x} cy={histPts.at(-1)!.y}
            r="3.5" fill={C_HIST} stroke={C_BG} strokeWidth="1.5" />
        )}

        {/* ── Hover layer ───────────────────────────────────────────────── */}
        {hover && (
          <g>
            {/* Crosshair */}
            <line x1={hover.svgX} y1={PAD_T} x2={hover.svgX} y2={PAD_T + CHART_H}
              stroke="rgba(255,255,255,0.28)" strokeWidth="0.8" strokeDasharray="3 3" />

            {/* Snapped dot on history line */}
            {!hover.isForecast && (
              <>
                <circle cx={hover.svgX} cy={hover.svgY} r="5.5"
                  fill={C_HIST} opacity="0.18" />
                <circle cx={hover.svgX} cy={hover.svgY} r="3.5"
                  fill={C_HIST} stroke={C_BG} strokeWidth="1.5" />
              </>
            )}

            {/* Tooltip card */}
            <rect x={ttX} y={ttY} width={TT_W} height={TT_H}
              rx="5" ry="5"
              fill={C_TT_BG} stroke={C_TT_BD} strokeWidth="0.8" />

            {/* Date header */}
            <text x={ttX + 9} y={ttY + 13} fontSize="8" fill="rgba(255,255,255,0.5)"
              style={{ fontFamily: 'system-ui, sans-serif' }}>
              {hover.dateLabel}
            </text>

            {/* Rows */}
            {!hover.isForecast ? (
              // History: single price row
              <>
                <text x={ttX + 9} y={ttY + 30} fontSize="8.5" fill="rgba(255,255,255,0.72)"
                  style={{ fontFamily: 'system-ui, sans-serif' }}>
                  Preço
                </text>
                <text x={ttX + TT_W - 9} y={ttY + 30} textAnchor="end"
                  fontSize="9" fill={C_HIST}
                  style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 600 }}>
                  ${hover.price?.toFixed(2)}
                </text>
              </>
            ) : (
              // Forecast: 3 target rows
              [
                { label: 'High', value: priceTarget.high, color: C_HIGH },
                { label: 'Mean', value: priceTarget.mean, color: C_MEAN },
                { label: 'Low',  value: priceTarget.low,  color: C_LOW  },
              ].filter(r => r.value != null).map((r, i) => (
                <g key={r.label}>
                  <text x={ttX + 9} y={ttY + 30 + i * 18} fontSize="8.5" fill="rgba(255,255,255,0.65)"
                    style={{ fontFamily: 'system-ui, sans-serif' }}>
                    {r.label}
                  </text>
                  <text x={ttX + TT_W - 9} y={ttY + 30 + i * 18} textAnchor="end"
                    fontSize="9" fill={r.color}
                    style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 600 }}>
                    ${r.value!.toFixed(2)}
                  </text>
                </g>
              ))
            )}
          </g>
        )}
      </svg>
    </div>
  );
}
