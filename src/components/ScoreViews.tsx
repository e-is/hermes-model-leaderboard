/**
 * Score explanation views — four ways to show WHY a model ranks where it does
 * for the selected profile, all built on the same `scoreBreakdown` the score
 * itself comes from (so a bar can never disagree with the number next to it).
 *
 *   stacked  — one stacked bar per model, a segment per criterion (points earned)
 *   columns  — top cards with a vertical histogram (height = grade, width = weight)
 *   heatmap  — models × criteria matrix of grades, columns ordered by weight
 *   duel     — two models side by side, criterion by criterion
 *   value    — quality (non-price criteria) vs weighted cost, with the Pareto frontier
 *
 * Pure CSS (no recharts): the bars are flex boxes, which keeps them crisp at any
 * width and themable through the desktop CSS variables.
 */
import { useMemo, useState, type ReactNode } from 'react'
import {
  CartesianGrid, LabelList, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from 'recharts'
import { computeGenericScore, paretoFrontier, scoreBreakdown, type CriterionBreakdown, type CriterionKey } from '../core/scoring'

export type ScoreViewId = 'classic' | 'stacked' | 'columns' | 'heatmap' | 'duel' | 'value'
export const SCORE_VIEWS: ScoreViewId[] = ['classic', 'stacked', 'columns', 'heatmap', 'duel', 'value']

export type CriterionMeta = { key: CriterionKey; label: string; icon: string }

/** One hue per criterion, grouped by family (quality / price / capability / deployment). */
export const CRITERION_COLORS: Record<CriterionKey, string> = {
  intelligence: '#7c5cff',
  coding: '#4f8ff7',
  agentic: '#22b8cf',
  price_in: '#2fb36d',
  price_out: '#79c752',
  cache_read: '#b5c934',
  context: '#f5a524',
  tools: '#f07b3f',
  has_vision: '#e64980',
  open_weights: '#12a594',
  fits_64gb: '#8a8f98',
}

type Scored = { id: string; label: string; _score: number; _rank: number; [k: string]: any }

type Props = {
  view: Exclude<ScoreViewId, 'classic'>
  models: Scored[]
  weights: Record<string, number>
  maxes: Record<string, number>
  criteria: CriterionMeta[]
  icon: (id: string) => string
  t: any
}

const medal = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`)
const r0 = (v: number) => Math.round(v)
/** Below this many points a duel criterion is a draw (rounding noise, not a lead). */
const DRAW_PTS = 0.5
const r1 = (v: number) => Math.round(v * 10) / 10

function useBreakdowns(models: Scored[], weights: Record<string, number>, maxes: Record<string, number>) {
  return useMemo(() => {
    const out: Record<string, CriterionBreakdown[]> = {}
    for (const m of models) out[m.id] = scoreBreakdown(m, weights, maxes)
    return out
  }, [models, weights, maxes])
}

function tip(t: any, meta: CriterionMeta, c: CriterionBreakdown): string {
  const grade = c.note == null ? t.views.na : `${r0(c.note)}/100`
  return `${meta.icon} ${meta.label} — ${t.views.weight} ×${c.weight} · ${t.views.grade} ${grade} → +${r1(c.points)} / ${r1(c.maxPoints)} ${t.views.points}`
}

/** Grade → background: transparent at 0, saturated green at 100. */
function gradeBg(note: number | null): string {
  if (note == null) return 'transparent'
  return `color-mix(in srgb, var(--ui-green) ${Math.round(8 + note * 0.5)}%, transparent)`
}

const box = {
  padding: 12,
  background: 'var(--ui-bg-editor)',
  borderRadius: 8,
  border: '1px solid var(--ui-stroke-tertiary)',
} as const

function Legend({ parts, metaOf }: { parts: CriterionBreakdown[]; metaOf: (k: CriterionKey) => CriterionMeta }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10, fontSize: 11, color: 'var(--ui-text-secondary)' }}>
      {parts.map(c => (
        <span key={c.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: CRITERION_COLORS[c.key] }} />
          {metaOf(c.key).icon} {metaOf(c.key).label}
          <b style={{ color: 'var(--ui-text-primary)' }}>×{c.weight}</b>
        </span>
      ))}
    </div>
  )
}

// ---- 1. Stacked score bars ----------------------------------------------------
function StackedView({ models, breakdowns, metaOf, icon, t }: ViewArgs) {
  const [showAll, setShowAll] = useState(false)
  const list = showAll ? models : models.slice(0, 8)
  const parts = breakdowns[models[0]?.id] ?? []
  return (
    <div style={box}>
      <Legend parts={parts} metaOf={metaOf} />
      <div style={{ display: 'grid', gridTemplateColumns: '34px minmax(120px, 220px) 1fr 44px', gap: '6px 10px', alignItems: 'center' }}>
        {list.map(m => (
          <Row key={m.id}>
            <span style={{ fontSize: 13, textAlign: 'center' }}>{medal(m._rank)}</span>
            <span style={{ fontSize: 12, fontWeight: m._rank <= 3 ? 700 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={m.id}>
              {icon(m.id)} {m.label}
            </span>
            <div style={{ display: 'flex', height: 18, borderRadius: 4, overflow: 'hidden', background: 'var(--ui-bg-tertiary)' }}>
              {(breakdowns[m.id] ?? []).map(c => (
                <div
                  key={c.key}
                  title={tip(t, metaOf(c.key), c)}
                  style={{
                    width: `${c.points}%`,
                    background: CRITERION_COLORS[c.key],
                    borderRight: c.points > 0 ? '1px solid var(--ui-bg-editor)' : undefined,
                  }}
                />
              ))}
            </div>
            <b style={{ fontSize: 13, textAlign: 'right', color: m._rank <= 3 ? 'var(--ui-orange)' : 'var(--ui-text-primary)' }}>{r0(m._score)}</b>
          </Row>
        ))}
      </div>
      {models.length > 8 && (
        <button onClick={() => setShowAll(v => !v)} style={linkBtn}>
          {showAll ? t.views.showLess : t.views.showAll(models.length)}
        </button>
      )}
    </div>
  )
}

// ---- 2. Cards with a vertical histogram -----------------------------------------
function ColumnsView({ models, breakdowns, metaOf, icon, t }: ViewArgs) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12 }}>
      {models.slice(0, 6).map(m => {
        const parts = breakdowns[m.id] ?? []
        const graded = parts.filter(c => c.note != null)
        const best = graded.reduce<CriterionBreakdown | null>((a, c) => (!a || (c.note ?? 0) > (a.note ?? 0) ? c : a), null)
        const worst = graded.reduce<CriterionBreakdown | null>((a, c) => (!a || (c.note ?? 0) < (a.note ?? 0) ? c : a), null)
        return (
          <div key={m.id} style={{ ...box, border: m._rank === 1 ? '2px solid var(--ui-orange)' : box.border }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={m.id}>
                {medal(m._rank)} {icon(m.id)} {m.label}
              </span>
              <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--ui-orange)' }}>{r0(m._score)}</span>
            </div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 3, height: 96, marginTop: 10, borderBottom: '1px solid var(--ui-stroke-secondary)' }}>
              {[25, 50, 75].map(g => (
                <div key={g} style={{ position: 'absolute', left: 0, right: 0, bottom: `${g}%`, borderTop: '1px dashed var(--ui-stroke-tertiary)' }} />
              ))}
              {parts.map(c => (
                <div
                  key={c.key}
                  title={tip(t, metaOf(c.key), c)}
                  style={{
                    flex: `${c.weight} 1 0`,
                    height: c.note == null ? '100%' : `${Math.max(2, c.note)}%`,
                    background: c.note == null ? 'transparent' : CRITERION_COLORS[c.key],
                    border: c.note == null ? `1px dashed ${CRITERION_COLORS[c.key]}` : undefined,
                    borderRadius: '3px 3px 0 0',
                    position: 'relative',
                    zIndex: 1,
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 3, marginTop: 3 }}>
              {parts.map(c => (
                <span key={c.key} title={metaOf(c.key).label} style={{ flex: `${c.weight} 1 0`, textAlign: 'center', fontSize: 11, overflow: 'hidden' }}>
                  {metaOf(c.key).icon}
                </span>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ui-text-tertiary)', display: 'grid', gap: 2 }}>
              {best && <span>💪 {t.views.strength} : {metaOf(best.key).label} {r0(best.note ?? 0)}</span>}
              {worst && worst !== best && <span>⚠️ {t.views.weakness} : {metaOf(worst.key).label} {r0(worst.note ?? 0)}</span>}
              {parts.some(c => c.note == null) && <span>❔ {t.views.missingData}</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---- 3. Heatmap matrix -------------------------------------------------------------
function HeatmapView({ models, breakdowns, metaOf, icon, t }: ViewArgs) {
  const [sortKey, setSortKey] = useState<CriterionKey | null>(null)
  const columns = [...(breakdowns[models[0]?.id] ?? [])].sort((a, b) => b.weight - a.weight)
  const noteOf = (id: string, key: CriterionKey) => breakdowns[id]?.find(c => c.key === key)?.note ?? null
  const rows = sortKey ? [...models].sort((a, b) => (noteOf(b.id, sortKey) ?? -1) - (noteOf(a.id, sortKey) ?? -1)) : models
  const th = { padding: '6px 4px', fontSize: 11, fontWeight: 600, color: 'var(--ui-text-secondary)', cursor: 'pointer', userSelect: 'none' as const, verticalAlign: 'bottom' as const }

  return (
    <div style={{ ...box, overflowX: 'auto', padding: 0 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--ui-bg-tertiary)' }}>
            <th style={{ ...th, textAlign: 'left', paddingLeft: 10 }} onClick={() => setSortKey(null)}>{t.views.model}{sortKey ? '' : ' ↓'}</th>
            {columns.map(c => (
              <th key={c.key} style={{ ...th, textAlign: 'center', minWidth: 58 }} onClick={() => setSortKey(c.key)} title={metaOf(c.key).label}>
                <div style={{ fontSize: 14 }}>{metaOf(c.key).icon}</div>
                <div style={{ whiteSpace: 'nowrap' }}>{metaOf(c.key).label}{sortKey === c.key ? ' ↓' : ''}</div>
                <div style={{ display: 'inline-block', marginTop: 2, padding: '0 5px', borderRadius: 999, background: CRITERION_COLORS[c.key], color: '#fff', fontWeight: 700 }}>×{c.weight}</div>
              </th>
            ))}
            <th style={{ ...th, textAlign: 'right', paddingRight: 10 }} onClick={() => setSortKey(null)}>{t.views.score}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(m => (
            <tr key={m.id} style={{ borderTop: '1px solid var(--ui-stroke-tertiary)' }}>
              <td style={{ padding: '5px 10px', whiteSpace: 'nowrap', fontWeight: m._rank <= 3 ? 700 : 500 }} title={m.id}>
                {medal(m._rank)} {icon(m.id)} {m.label}
              </td>
              {columns.map(col => {
                const c = breakdowns[m.id]?.find(x => x.key === col.key)
                const note = c?.note ?? null
                return (
                  <td key={col.key} title={c ? tip(t, metaOf(col.key), c) : ''}
                    style={{ textAlign: 'center', padding: '5px 4px', background: gradeBg(note), color: note == null ? 'var(--ui-text-quaternary)' : 'var(--ui-text-primary)', fontStyle: note == null ? 'italic' : undefined }}>
                    {note == null ? t.views.na : r0(note)}
                  </td>
                )
              })}
              <td style={{ padding: '5px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                <span style={{ display: 'inline-block', width: 50, height: 6, marginRight: 6, borderRadius: 3, background: 'var(--ui-bg-tertiary)', verticalAlign: 'middle', overflow: 'hidden' }}>
                  <span style={{ display: 'block', width: `${m._score}%`, height: '100%', background: 'var(--ui-orange)' }} />
                </span>
                <b>{r0(m._score)}</b>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---- 4. Duel -----------------------------------------------------------------------
function DuelView({ models, breakdowns, metaOf, icon, t }: ViewArgs) {
  const [aId, setA] = useState<string | null>(null)
  const [bId, setB] = useState<string | null>(null)
  const a = models.find(m => m.id === aId) ?? models[0]
  const b = models.find(m => m.id === bId && m.id !== a?.id) ?? models.find(m => m.id !== a?.id)
  if (!a || !b) return <div style={box}>{t.views.needTwo}</div>

  const pa = breakdowns[a.id] ?? []
  const pb = breakdowns[b.id] ?? []
  const winsA = pa.filter((c, i) => c.points - (pb[i]?.points ?? 0) >= DRAW_PTS).length
  const winsB = pb.filter((c, i) => c.points - (pa[i]?.points ?? 0) >= DRAW_PTS).length
  const select = (value: string, onChange: (v: string) => void, exclude: string) => (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ padding: '4px 6px', borderRadius: 6, border: '1px solid var(--ui-stroke-secondary)', background: 'var(--ui-bg-editor)', color: 'var(--ui-text-primary)', fontSize: 12, maxWidth: 220 }}>
      {models.filter(m => m.id !== exclude).map(m => <option key={m.id} value={m.id}>#{m._rank} {m.label}</option>)}
    </select>
  )
  const bar = (c: CriterionBreakdown | undefined, win: boolean, dir: 'left' | 'right') => (
    <div style={{ display: 'flex', justifyContent: dir === 'left' ? 'flex-end' : 'flex-start', alignItems: 'center', gap: 6 }}>
      {dir === 'left' && <span style={{ fontSize: 11, color: 'var(--ui-text-tertiary)' }}>{c?.note == null ? t.views.na : r0(c.note)}</span>}
      <div style={{ width: '70%', display: 'flex', justifyContent: dir === 'left' ? 'flex-end' : 'flex-start', height: 14, background: 'var(--ui-bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${c?.note ?? 0}%`, background: c ? (win ? CRITERION_COLORS[c.key] : `color-mix(in srgb, ${CRITERION_COLORS[c.key]} 30%, transparent)`) : undefined }} />
      </div>
      {dir === 'right' && <span style={{ fontSize: 11, color: 'var(--ui-text-tertiary)' }}>{c?.note == null ? t.views.na : r0(c.note)}</span>}
    </div>
  )

  return (
    <div style={box}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <div style={{ textAlign: 'right' }}>
          {select(a.id, setA, b.id)}
          <div style={{ fontSize: 22, fontWeight: 800, color: a._score >= b._score ? 'var(--ui-orange)' : 'var(--ui-text-secondary)' }}>{icon(a.id)} {r0(a._score)}</div>
          <div style={{ fontSize: 11, color: 'var(--ui-text-tertiary)' }}>{t.views.winsOn(winsA)}</div>
        </div>
        <div style={{ fontWeight: 800, color: 'var(--ui-text-tertiary)' }}>{t.views.versus}</div>
        <div>
          {select(b.id, setB, a.id)}
          <div style={{ fontSize: 22, fontWeight: 800, color: b._score > a._score ? 'var(--ui-orange)' : 'var(--ui-text-secondary)' }}>{r0(b._score)} {icon(b.id)}</div>
          <div style={{ fontSize: 11, color: 'var(--ui-text-tertiary)' }}>{t.views.winsOn(winsB)}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 1fr', gap: '6px 8px', alignItems: 'center' }}>
        {pa.map((ca, i) => {
          const cb = pb[i]
          const diff = ca.points - (cb?.points ?? 0)
          return (
            <Row key={ca.key}>
              {bar(ca, diff >= DRAW_PTS, 'left')}
              <div style={{ textAlign: 'center', fontSize: 11 }} title={`${tip(t, metaOf(ca.key), ca)}\n${cb ? tip(t, metaOf(ca.key), cb) : ''}`}>
                <div style={{ fontWeight: 600 }}>{metaOf(ca.key).icon} {metaOf(ca.key).label} <span style={{ color: 'var(--ui-text-tertiary)' }}>×{ca.weight}</span></div>
                <div style={{ color: Math.abs(diff) < DRAW_PTS ? 'var(--ui-text-quaternary)' : 'var(--ui-text-secondary)' }}>
                  {Math.abs(diff) < DRAW_PTS ? '=' : `${diff > 0 ? '◀' : ''} ${r1(Math.abs(diff))} ${t.views.points} ${diff < 0 ? '▶' : ''}`}
                </div>
              </div>
              {bar(cb, diff <= -DRAW_PTS, 'right')}
            </Row>
          )
        })}
      </div>
    </div>
  )
}


// ---- 5. Quality vs cost -------------------------------------------------------------
const PRICE_KEYS = ['price_in', 'price_out', 'cache_read'] as const
/** Floor for the log-scale cost axis: free models sit on it instead of at -infinity. */
const COST_FLOOR = 0.01

type ValuePoint = { id: string; label: string; quality: number; cost: number; rawCost: number; score: number; rank: number }

function ValueView({ models, weights, maxes, metaOf, t }: ViewArgs & { weights: Record<string, number>; maxes: Record<string, number> }) {
  // Cost blend follows the profile's price weights; a profile that ignores
  // price still gets a meaningful axis (input and output at equal weight).
  const priceW: Record<string, number> = {}
  for (const k of PRICE_KEYS) if ((weights[k] ?? 0) > 0) priceW[k] = weights[k]
  if (!Object.keys(priceW).length) { priceW.price_in = 1; priceW.price_out = 1 }
  const priceTotal = Object.values(priceW).reduce((a, b) => a + b, 0)

  const qualityW: Record<string, number> = {}
  for (const [k, w] of Object.entries(weights)) if (w > 0 && !(PRICE_KEYS as readonly string[]).includes(k)) qualityW[k] = w
  const qualityKeys = Object.keys(qualityW) as CriterionKey[]
  if (!qualityKeys.length) return <div style={{ ...box, fontSize: 12, color: 'var(--ui-text-tertiary)' }}>{t.views.noQuality}</div>

  const priceOf = (m: Scored, k: string) =>
    k === 'price_in' ? m.prompt_price : k === 'price_out' ? m.completion_price : (m.cache_read_price ?? m.prompt_price)
  const points: ValuePoint[] = models.map(m => {
    const rawCost = Object.entries(priceW).reduce((sum, [k, w]) => sum + (priceOf(m, k) ?? 0) * w, 0) / priceTotal
    return {
      id: m.id, label: m.label, rank: m._rank, score: m._score, rawCost,
      cost: Math.max(COST_FLOOR, rawCost),
      quality: computeGenericScore(m, qualityW, maxes),
    }
  })
  const frontier = paretoFrontier(points).sort((a, b) => a.quality - b.quality)
  const onFrontier = new Set(frontier.map(p => p.id))
  const others = points.filter(p => !onFrontier.has(p.id))

  const fmtCost = (v: number) => (v <= COST_FLOOR ? t.views.free : `$${v < 1 ? v.toFixed(2) : v.toFixed(1)}`)
  const xLabel = `${t.views.axisQuality} — ${qualityKeys.map(k => `${metaOf(k).label} ×${qualityW[k]}`).join(', ')}`
  const yLabel = `${t.views.axisCost} — ${Object.entries(priceW).map(([k, w]) => `${metaOf(k as CriterionKey).label} ×${w}`).join(', ')}`

  const TooltipBox = ({ active, payload }: any) => {
    const p: ValuePoint | undefined = active && payload?.[0]?.payload
    if (!p) return null
    return (
      <div style={{ ...box, padding: '6px 10px', fontSize: 12, boxShadow: 'var(--shadow-sm)' }}>
        <b>{medal(p.rank)} {p.label}</b>
        <div>{t.views.axisQuality} : {r0(p.quality)}/100</div>
        <div>{t.views.axisCost} : {fmtCost(p.rawCost)}/M tk</div>
        <div>{t.views.score} : {r0(p.score)}</div>
        {onFrontier.has(p.id) && <div style={{ color: 'var(--ui-orange)' }}>★ {t.views.frontier}</div>}
      </div>
    )
  }
  const axisTick = { fontSize: 11, fill: 'var(--ui-text-tertiary)' }

  return (
    <div style={box}>
      <div style={{ fontSize: 11, color: 'var(--ui-text-tertiary)', marginBottom: 6 }}>↘ {t.views.valueRead}</div>
      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart margin={{ top: 28, right: 32, bottom: 28, left: 12 }}>
          <CartesianGrid stroke="var(--ui-stroke-tertiary)" strokeDasharray="3 3" />
          <XAxis type="number" dataKey="quality" domain={[0, 100]} tick={axisTick} stroke="var(--ui-stroke-secondary)"
            label={{ value: xLabel, position: 'insideBottom', offset: -16, fontSize: 11, fill: 'var(--ui-text-secondary)' }} />
          <YAxis type="number" dataKey="cost" scale="log" domain={['auto', 'auto']} allowDataOverflow={false} tickFormatter={fmtCost}
            tick={axisTick} stroke="var(--ui-stroke-secondary)" width={56}
            label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: 4, fontSize: 11, fill: 'var(--ui-text-secondary)', style: { textAnchor: 'middle' } }} />
          <Tooltip content={<TooltipBox />} cursor={{ strokeDasharray: '3 3' }} />
          <Scatter name={t.views.others} data={others} fill="var(--ui-text-quaternary)" isAnimationActive={false}>
            <LabelList dataKey="label" position="top" fontSize={10} fill="var(--ui-text-tertiary)" />
          </Scatter>
          <Scatter name={t.views.frontier} data={frontier} fill="var(--ui-orange)" line={{ stroke: 'var(--ui-orange)', strokeDasharray: '4 3' }} lineType="joint" isAnimationActive={false}>
            <LabelList dataKey="label" position="top" fontSize={11} fontWeight={700} fill="var(--ui-text-primary)" />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <div style={{ fontSize: 12, marginTop: 4 }}>
        <b style={{ color: 'var(--ui-orange)' }}>★ {t.views.frontier}</b>
        <span style={{ color: 'var(--ui-text-tertiary)' }}> — {t.views.frontierHint}</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {[...frontier].reverse().map(p => (
            <span key={p.id} style={{ padding: '2px 8px', borderRadius: 999, border: '1px solid var(--ui-orange)', fontSize: 11 }}>
              {p.label} · {r0(p.quality)} · {fmtCost(p.rawCost)}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---- plumbing ------------------------------------------------------------------------
type ViewArgs = {
  models: Scored[]
  breakdowns: Record<string, CriterionBreakdown[]>
  metaOf: (k: CriterionKey) => CriterionMeta
  icon: (id: string) => string
  t: any
}

/** Grid rows are flat children; a fragment keeps each model's cells together in the source. */
function Row({ children }: { children: ReactNode }) {
  return <>{children}</>
}

const linkBtn = { marginTop: 8, border: 'none', background: 'transparent', color: 'var(--ui-accent)', cursor: 'pointer', fontSize: 12, padding: 0 } as const

export function ScoreView({ view, models, weights, maxes, criteria, icon, t }: Props) {
  const breakdowns = useBreakdowns(models, weights, maxes)
  const metaOf = (k: CriterionKey) => criteria.find(c => c.key === k) ?? { key: k, label: k, icon: '•' }
  if (!models.length) return null
  if (!(breakdowns[models[0].id] ?? []).length) return <div style={{ ...box, fontSize: 12, color: 'var(--ui-text-tertiary)' }}>{t.views.noCriteria}</div>

  const args = { models, breakdowns, metaOf, icon, t }
  if (view === 'stacked') return <StackedView {...args} />
  if (view === 'columns') return <ColumnsView {...args} />
  if (view === 'heatmap') return <HeatmapView {...args} />
  if (view === 'value') return <ValueView {...args} weights={weights} maxes={maxes} />
  return <DuelView {...args} />
}
