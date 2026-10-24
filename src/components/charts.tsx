/**
 * The plugin's charts, drawn as plain SVG.
 *
 * Recharts is not an option here: it drags lodash and d3 into the bundle, and the
 * catalogue's desktop-surface check fails any `X.prototype.y =` assignment in
 * `desktop/plugin.js` — lodash's own `Hash.prototype.clear = hashClear` is 50 of
 * those findings. So the five shapes this page needs (vertical bars, horizontal
 * bars, a radar and a log-x scatter) are drawn here, on top of a width measured
 * with ResizeObserver. No dependency, no animation, ~4 KB of bundle.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'

/** Width of the box the ref points at, kept current through resizes. */
export function useMeasure<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width ?? 0
      if (w > 0) setWidth(w)
    })
    ro.observe(el)
    setWidth(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

/** Round tick values that cover 0..max in four steps. */
function niceTicks(max: number, count = 4): number[] {
  if (!isFinite(max) || max <= 0) return [0, 1]
  const raw = max / count
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) ?? 10 * mag
  const out: number[] = []
  for (let v = 0; v <= max + step * 0.001; v += step) out.push(Number(v.toFixed(6)))
  if (out[out.length - 1] < max) out.push(max)
  return out
}

const axisText = (x: number, y: number, text: string, anchor = 'middle', size = 10) =>
  <text x={x} y={y} fontSize={size} fill="var(--ui-text-tertiary)" textAnchor={anchor}>{text}</text>

// ── vertical bars (one value per category) ──────────────────────────────────
export function BarsVertical({ data, valueKey, color, height = 250, format, formatTick }: {
  data: any[]
  valueKey: string
  color: string
  height?: number
  format?: (v: number) => string
  /** Axis ticks want something shorter than the value/tooltip text. */
  formatTick?: (v: number) => string
}) {
  const [ref, width] = useMeasure<HTMLDivElement>()
  const pad = { l: 46, r: 8, t: 10, b: 62 }
  const iw = Math.max(0, width - pad.l - pad.r)
  const ih = Math.max(0, height - pad.t - pad.b)
  const values = data.map(d => Number(d[valueKey]) || 0)
  const ticks = niceTicks(Math.max(1e-9, ...values))
  const top = ticks[ticks.length - 1] || 1
  const y = (v: number) => pad.t + ih - (v / top) * ih
  // With many models the rotated labels are what breaks first, so the slot width
  // also caps the label font a touch.
  const slot = data.length ? iw / data.length : iw
  const bw = Math.max(2, Math.min(48, slot * 0.72))

  return (
    <div ref={ref} style={{ width: '100%', height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img">
          {ticks.map(t => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke="var(--ui-stroke-tertiary)" strokeDasharray={t === 0 ? undefined : '2 3'} />
              {axisText(pad.l - 6, y(t) + 3, (formatTick ?? format) ? (formatTick ?? format)!(t) : String(t), 'end')}
            </g>
          ))}
          {data.map((d, i) => {
            const v = values[i]
            const cx = pad.l + slot * i + slot / 2
            return (
              <g key={d.id ?? d.label ?? i}>
                <rect x={cx - bw / 2} y={y(v)} width={bw} height={Math.max(1, pad.t + ih - y(v))} rx={2} fill={color}>
                  <title>{`${d.label}: ${format ? format(v) : v}`}</title>
                </rect>
                {/* Rotated: model names are long and the slots are narrow, so
                    horizontal labels overlap into an unreadable smear. */}
                <text
                  x={cx} y={pad.t + ih + 10}
                  fontSize={Math.min(10, Math.max(8, slot / 4.5))}
                  fill="var(--ui-text-tertiary)"
                  textAnchor="end"
                  transform={`rotate(-38 ${cx} ${pad.t + ih + 10})`}
                >{d.label ?? ''}</text>
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}

// ── horizontal bars (a label column, then the bar) ─────────────────────────
export function BarsHorizontal({ data, valueKey, color, height = 300, labelWidth = 140, format }: {
  data: any[]
  valueKey: string
  color: string
  height?: number
  labelWidth?: number
  format?: (v: number) => string
}) {
  const [ref, width] = useMeasure<HTMLDivElement>()
  const values = data.map(d => Number(d[valueKey]) || 0)
  const top = Math.max(1e-9, ...values)
  const iw = Math.max(0, width - labelWidth - 56)
  const row = data.length ? Math.min(28, (height - 8) / data.length) : 26
  const bh = Math.max(4, row * 0.62)
  const drawn = Math.max(height, data.length ? row * data.length + 8 : height)

  return (
    <div ref={ref} style={{ width: '100%', minHeight: height }}>
      {width > 0 && (
        <svg width={width} height={drawn} role="img">
          {data.map((d, i) => {
            const v = values[i]
            const yTop = i * row + 4
            return (
              <g key={d.id ?? d.label ?? i}>
                {axisText(labelWidth - 8, yTop + bh / 2 + 4, String(d.label ?? ''), 'end', 10)}
                <rect x={labelWidth} y={yTop} width={Math.max(1, (v / top) * iw)} height={bh} rx={2} fill={color}>
                  <title>{`${d.label}: ${format ? format(v) : v}`}</title>
                </rect>
                {axisText(labelWidth + Math.max(1, (v / top) * iw) + 6, yTop + bh / 2 + 4, format ? format(v) : String(v), 'start', 10)}
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}

// ── radar (one polygon per series over the same axes) ──────────────────────
export function RadarChart({ axes, series, size = 450 }: {
  axes: string[]
  series: { label: string; color: string; values: number[] }[]
  size?: number
}) {
  const [ref, width] = useMeasure<HTMLDivElement>()
  const side = Math.max(220, Math.min(size, width || size))
  const cx = side / 2
  const cy = side / 2
  const r = side / 2 - 54
  const n = axes.length
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2
  const at = (i: number, value: number) => {
    const t = Math.max(0, Math.min(100, value)) / 100
    return [cx + Math.cos(angle(i)) * r * t, cy + Math.sin(angle(i)) * r * t]
  }
  const ring = (t: number) => axes.map((_, i) => at(i, t * 100).join(',')).join(' ')

  return (
    <div ref={ref} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
      {width > 0 && (
        <svg width={side} height={side} role="img">
          {[0.25, 0.5, 0.75, 1].map(t => (
            <polygon key={t} points={ring(t)} fill="none" stroke="var(--ui-stroke-tertiary)" />
          ))}
          {axes.map((a, i) => {
            const [x, y] = at(i, 100)
            const [lx, ly] = [cx + Math.cos(angle(i)) * (r + 14), cy + Math.sin(angle(i)) * (r + 14)]
            const anchor = Math.abs(lx - cx) < 6 ? 'middle' : lx > cx ? 'start' : 'end'
            return (
              <g key={a}>
                <line x1={cx} y1={cy} x2={x} y2={y} stroke="var(--ui-stroke-tertiary)" />
                {axisText(lx, ly + 3, a, anchor, 10)}
              </g>
            )
          })}
          {series.map(s => (
            <polygon
              key={s.label}
              points={s.values.map((v, i) => at(i, v).join(',')).join(' ')}
              fill={s.color}
              fillOpacity={0.12}
              stroke={s.color}
              strokeWidth={1.5}
            >
              <title>{s.label}</title>
            </polygon>
          ))}
        </svg>
      )}
    </div>
  )
}

// ── scatter with a logarithmic cost axis (the Pareto picture) ───────────────
export type ScatterPoint = {
  id: string
  label: string
  x: number        // real cost, used for the log position and the tooltip
  y: number        // 0..100 quality
  frontier?: boolean
  title?: ReactNode
}

export function ScatterLog({ points, lo, hi, ticks, formatX, xLabel, yLabel, height = 400 }: {
  points: ScatterPoint[]
  lo: number
  hi: number
  ticks: number[]
  formatX: (v: number) => string
  xLabel: string
  yLabel: string
  height?: number
}) {
  const [ref, width] = useMeasure<HTMLDivElement>()
  const [hover, setHover] = useState<{ p: ScatterPoint; x: number; y: number } | null>(null)
  const pad = { l: 52, r: 24, t: 26, b: 44 }
  const iw = Math.max(0, width - pad.l - pad.r)
  const ih = Math.max(0, height - pad.t - pad.b)
  const l0 = Math.log10(Math.max(lo, 1e-9))
  const l1 = Math.log10(Math.max(hi, lo * 1.0001))
  const px = (v: number) => pad.l + ((Math.log10(Math.max(v, lo)) - l0) / (l1 - l0)) * iw
  const py = (v: number) => pad.t + ih - (Math.max(0, Math.min(100, v)) / 100) * ih

  // The frontier line joins the same points the legend calls best trade-offs,
  // left (cheaper) to right.
  const front = points.filter(p => p.frontier).sort((a, b) => a.x - b.x)

  return (
    <div ref={ref} style={{ width: '100%', height, position: 'relative' }}>
      {width > 0 && (
        <svg width={width} height={height} role="img"
          onMouseLeave={() => setHover(null)}>
          {[0, 25, 50, 75, 100].map(t => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={py(t)} y2={py(t)} stroke="var(--ui-stroke-tertiary)" strokeDasharray="3 3" />
              {axisText(pad.l - 8, py(t) + 3, String(t), 'end')}
            </g>
          ))}
          {ticks.map(t => (
            <g key={t}>
              <line x1={px(t)} x2={px(t)} y1={pad.t} y2={pad.t + ih} stroke="var(--ui-stroke-tertiary)" strokeDasharray="3 3" />
              {axisText(px(t), pad.t + ih + 15, formatX(t), 'middle')}
            </g>
          ))}
          <line x1={pad.l} x2={width - pad.r} y1={pad.t + ih} y2={pad.t + ih} stroke="var(--ui-stroke-secondary)" />
          <line x1={pad.l} x2={pad.l} y1={pad.t} y2={pad.t + ih} stroke="var(--ui-stroke-secondary)" />
          {axisText(width / 2, height - 6, xLabel, 'middle', 11)}
          <text x={12} y={pad.t + ih / 2} fontSize={11} fill="var(--ui-text-secondary)" textAnchor="middle"
            transform={`rotate(-90 12 ${pad.t + ih / 2})`}>{yLabel}</text>

          {front.length > 1 && (
            <polyline
              points={front.map(p => `${px(p.x)},${py(p.y)}`).join(' ')}
              fill="none" stroke="var(--ui-orange)" strokeDasharray="4 3" strokeWidth={1.5}
            />
          )}
          {points.map(p => {
            const x = px(p.x)
            const y = py(p.y)
            return (
              <g key={p.id}>
                <circle
                  cx={x} cy={y} r={p.frontier ? 6 : 4.5}
                  fill={p.frontier ? 'var(--ui-orange)' : 'var(--ui-text-quaternary)'}
                  onMouseEnter={() => setHover({ p, x, y })}
                />
                {axisText(x, y - 10, p.label, 'middle', p.frontier ? 11 : 10)}
              </g>
            )
          })}
        </svg>
      )}
      {hover && (
        <div style={{
          position: 'absolute', left: Math.min(hover.x + 12, Math.max(0, width - 200)), top: Math.max(0, hover.y - 10),
          pointerEvents: 'none', background: 'var(--ui-bg-editor)', border: '1px solid var(--ui-stroke-tertiary)',
          borderRadius: 6, padding: '6px 10px', fontSize: 12, zIndex: 2, maxWidth: 220,
        }}>
          {hover.p.title}
        </div>
      )}
    </div>
  )
}
