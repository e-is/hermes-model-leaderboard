/** Pure scoring helpers (no React/SDK) — unit-tested in tests/unit/. */

export function parseTargetLangs(raw?: string): string[] {
  if (!raw) return []
  return raw.split(/[,;]/).map(s => s.trim().toLowerCase()).filter(Boolean)
}

export function computeGenericScore(m: any, weights: Record<string, number>, maxes: Record<string, number>, targetLangs?: string): number {
  const totalWeight = Object.values(weights).reduce((sum, w) => sum + (w || 0), 0)
  if (totalWeight <= 0) return 0

  const intel = (m.intelligence_index ?? 0) / (maxes.maxIntel || 1)
  const coding = (m.coding_index ?? 0) / (maxes.maxCoding || 1)
  const agentic = (m.agentic_index ?? 0) / (maxes.maxAgentic || 1)

  const pIn = maxes.maxPrice > 0 ? 1 - Math.min(1, (m.prompt_price ?? 0) / maxes.maxPrice) : 1
  const pOut = maxes.maxPrice > 0 ? 1 - Math.min(1, (m.completion_price ?? 0) / maxes.maxPrice) : 1
  const pCache = (maxes.maxPriceCache || 1) > 0 ? 1 - Math.min(1, (m.cache_read_price ?? 0) / (maxes.maxPriceCache || 1)) : 1
  const ctx = maxes.maxCtx > 0 ? Math.min(1, (m.context_length ?? 0) / maxes.maxCtx) : 0

  const hasV = m.has_vision ? 1 : 0
  const hasT = (m.supported_parameters || []).includes('tools') ? 1 : 0
  const isOpen = m.open_weights ? 1 : 0
  const fits64 = m.gpu?.fits_64gb ? 1 : 0
  const toolsVision = hasT * hasV

  // Languages: fraction of target languages covered by the model's iso_langs
  const targets = parseTargetLangs(targetLangs)
  const modelLangs = (m.iso_langs || []).map((l: string) => l.toLowerCase())
  const langScore = targets.length > 0
    ? targets.filter(t => modelLangs.includes(t)).length / targets.length
    : 0

  const values: Record<string, number> = {
    intelligence: intel,
    coding: coding,
    agentic: agentic,
    price_in: pIn,
    price_out: pOut,
    cache_read: pCache,
    context: ctx,
    tools: hasT,
    has_vision: hasV,
    languages: langScore,
    open_weights: isOpen,
    fits_64gb: fits64,
    tools_vision: toolsVision,
  }

  let weightedSum = 0
  for (const [k, w] of Object.entries(weights)) {
    if (w > 0) {
      weightedSum += (values[k] ?? 0) * w
    }
  }

  const score = (weightedSum / totalWeight) * 100
  return Math.max(0, Math.min(100, score))
}
