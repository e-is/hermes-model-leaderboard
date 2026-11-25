/** Pure scoring helpers (no React/SDK) — unit-tested in tests/unit/. */

/** Every scoring criterion, in display order. */
export const CRITERIA_KEYS = [
  'intelligence', 'coding', 'agentic',
  'speed', 'latency', 'cost_task',
  'price_in', 'price_out', 'cache_read',
  'context', 'tools', 'has_vision',
  'open_weights', 'fits_64gb',
] as const

/**
 * The reference task a "cost per task" figure is computed for: one Hermes turn on a real
 * card — 20 000 prompt tokens (a system prompt plus a few tool results) and 2 000 completion
 * tokens, 60 % of the prompt served from the cache.
 *
 * It is a stated convention, not a measurement. What makes the number comparable is that
 * every model is priced for the SAME task: `price_in` and `price_out` alone weight the two
 * directions equally, which prices a chat model like an agent one.
 */
export const REFERENCE_TASK = { prompt_tokens: 20_000, completion_tokens: 2_000, cache_hit_ratio: 0.6 }

export type CriterionKey = typeof CRITERIA_KEYS[number]

/**
 * Normalised 0..1 value of each criterion for one model (1 = best of the
 * tracked set). `null` means the data is missing (no Artificial Analysis index
 * yet): the score counts it as 0, the views show it as "n/a" so a low score
 * caused by a hole in the data is not mistaken for a weak model.
 */
/** Dollars for one reference task, or null when the model has no price at all. */
export function costPerTask(m: any): number | null {
  const pin = m?.prompt_price
  const pout = m?.completion_price
  if (!Number.isFinite(pin) || !Number.isFinite(pout)) return null
  const cache = Number.isFinite(m?.cache_read_price) && m.cache_read_price >= 0 ? m.cache_read_price : pin
  const cached = REFERENCE_TASK.prompt_tokens * REFERENCE_TASK.cache_hit_ratio
  const fresh = REFERENCE_TASK.prompt_tokens - cached
  // Prices are quoted per million tokens: without the divisor the column showed $14 400 for a
  // task that costs about two cents.
  return (fresh * pin + cached * cache + REFERENCE_TASK.completion_tokens * pout) / 1_000_000
}

export function criterionValues(m: any, maxes: Record<string, number>): Record<CriterionKey, number | null> {
  const ratio = (v: number | null | undefined, max: number) => (v == null ? null : Math.min(1, v / (max || 1)))
  const cheap = (v: number | null | undefined, max: number) => (max > 0 ? 1 - Math.min(1, (v ?? 0) / max) : 1)
  // "Lower is better" where MISSING must stay missing: `cheap()` reads a hole as a zero, which
  // is right for a free model and wrong for an unmeasured one — an unmeasured latency is not
  // the fastest latency in the table.
  const low = (v: number | null | undefined, max: number) => (v == null ? null : max > 0 ? 1 - Math.min(1, v / max) : null)

  return {
    intelligence: ratio(m.intelligence_index, maxes.maxIntel),
    coding: ratio(m.coding_index, maxes.maxCoding),
    agentic: ratio(m.agentic_index, maxes.maxAgentic),
    // Measured by Artificial Analysis: absent for a model nobody published a measurement for.
    speed: ratio(m.speed_tps, maxes.maxSpeed),
    latency: low(m.latency_s, maxes.maxLatency),
    cost_task: low(costPerTask(m), maxes.maxCostTask),
    price_in: cheap(m.prompt_price, maxes.maxPrice),
    price_out: cheap(m.completion_price, maxes.maxPrice),
    cache_read: cheap(m.cache_read_price, maxes.maxPriceCache || 1),
    context: maxes.maxCtx > 0 ? Math.min(1, (m.context_length ?? 0) / maxes.maxCtx) : 0,
    tools: (m.supported_parameters || []).includes('tools') ? 1 : 0,
    has_vision: m.has_vision ? 1 : 0,
    open_weights: m.open_weights ? 1 : 0,
    fits_64gb: m.gpu?.fits_64gb ? 1 : 0,
  }
}

export type CriterionBreakdown = {
  key: CriterionKey
  weight: number
  /** 0..100 grade on this criterion, null when the data is missing. */
  note: number | null
  /** Points (out of 100) this criterion adds to the final score. */
  points: number
  /** Points this criterion could add at most (its share of the total weight). */
  maxPoints: number
}

/** Per-criterion decomposition of the score: `sum(points) === computeGenericScore`. */
export function scoreBreakdown(m: any, weights: Record<string, number>, maxes: Record<string, number>): CriterionBreakdown[] {
  const totalWeight = Object.values(weights).reduce((sum, w) => sum + (w > 0 ? w : 0), 0)
  if (totalWeight <= 0) return []
  const values = criterionValues(m, maxes)

  return CRITERIA_KEYS
    .filter(key => (weights[key] ?? 0) > 0)
    .map(key => {
      const weight = weights[key]
      const v = values[key]
      const maxPoints = (weight / totalWeight) * 100
      return { key, weight, note: v == null ? null : v * 100, points: (v ?? 0) * maxPoints, maxPoints }
    })
}

export function computeGenericScore(m: any, weights: Record<string, number>, maxes: Record<string, number>): number {
  const totalWeight = Object.values(weights).reduce((sum, w) => sum + (w > 0 ? w : 0), 0)
  if (totalWeight <= 0) return 0
  const values = criterionValues(m, maxes)
  // Same sum as scoreBreakdown's points, divided once (no float drift: a
  // perfect model must score exactly 100).
  const weighted = CRITERIA_KEYS.reduce((sum, key) => sum + (values[key] ?? 0) * Math.max(0, weights[key] ?? 0), 0)
  return Math.max(0, Math.min(100, (weighted / totalWeight) * 100))
}

/** Points no other point beats on both axes (cheaper-or-equal AND better-or-equal),
 *  in increasing cost order. */
export function paretoFrontier<T extends { quality: number; cost: number }>(points: T[]): T[] {
  const byCost = [...points].sort((a, b) => a.cost - b.cost || b.quality - a.quality)
  const out: T[] = []
  let best = -Infinity
  for (const p of byCost) {
    if (p.quality > best) { out.push(p); best = p.quality }
  }
  return out
}
