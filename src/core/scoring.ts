/** Pure scoring helpers (no React/SDK) — unit-tested in tests/unit/. */

/** Every scoring criterion, in display order. */
export const CRITERIA_KEYS = [
  'intelligence', 'coding', 'agentic',
  'price_in', 'price_out', 'cache_read',
  'context', 'tools', 'has_vision',
  'open_weights', 'fits_64gb',
] as const

export type CriterionKey = typeof CRITERIA_KEYS[number]

/**
 * Normalised 0..1 value of each criterion for one model (1 = best of the
 * tracked set). `null` means the data is missing (no Artificial Analysis index
 * yet): the score counts it as 0, the views show it as "n/a" so a low score
 * caused by a hole in the data is not mistaken for a weak model.
 */
export function criterionValues(m: any, maxes: Record<string, number>): Record<CriterionKey, number | null> {
  const ratio = (v: number | null | undefined, max: number) => (v == null ? null : v / (max || 1))
  const cheap = (v: number | null | undefined, max: number) => (max > 0 ? 1 - Math.min(1, (v ?? 0) / max) : 1)

  return {
    intelligence: ratio(m.intelligence_index, maxes.maxIntel),
    coding: ratio(m.coding_index, maxes.maxCoding),
    agentic: ratio(m.agentic_index, maxes.maxAgentic),
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
