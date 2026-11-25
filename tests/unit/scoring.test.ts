/**
 * Unit tests for the pure scoring helpers (src/core/scoring.ts).
 *
 * Run: node --experimental-strip-types --test tests/unit/scoring.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { computeGenericScore, costPerTask, criterionValues, REFERENCE_TASK } from '../../src/core/scoring.ts'

const MAXES = {
  maxIntel: 40,
  maxCoding: 40,
  maxAgentic: 30,
  maxPrice: 10,
  maxPriceCache: 2,
  maxCtx: 1_000_000
}

const baseModel = {
  intelligence_index: 40,
  coding_index: 40,
  agentic_index: 30,
  prompt_price: 0,
  completion_price: 0,
  cache_read_price: 0,
  context_length: 1_000_000,
  has_vision: true,
  supported_parameters: ['tools'],
  open_weights: true,
  gpu: { fits_64gb: true }
}


test('perfect model on all-weights profile scores 100', () => {
  const weights = {
    intelligence: 5, coding: 5, agentic: 5, price_in: 3, price_out: 3,
    cache_read: 2, context: 3, tools: 2, has_vision: 1,
    open_weights: 1, fits_64gb: 1
  }
  assert.equal(computeGenericScore(baseModel as any, weights, MAXES), 100)
})

test('zero weights score 0', () => {
  assert.equal(computeGenericScore(baseModel as any, {}, MAXES), 0)
})

test('price penalty lowers the score', () => {
  const weights = { price_in: 5, price_out: 5 }
  const expensive = { ...baseModel, prompt_price: 10, completion_price: 10 }
  assert.equal(computeGenericScore(expensive as any, weights, MAXES), 0)
  const cheap = { ...baseModel, prompt_price: 5, completion_price: 5 }
  assert.equal(computeGenericScore(cheap as any, weights, MAXES), 50)
})


test('score is clamped to 0..100', () => {
  const s = computeGenericScore(baseModel as any, { intelligence: 5 }, { ...MAXES, maxIntel: 1 })
  assert.equal(s, 100)
})

test('scoreBreakdown points add up to the score', async () => {
  const { scoreBreakdown } = await import('../../src/core/scoring.ts')
  const weights = { intelligence: 5, price_out: 3, tools: 2, coding: 0 }
  const m = { ...baseModel, intelligence_index: 20, completion_price: 5 }
  const parts = scoreBreakdown(m, weights, MAXES)
  assert.deepEqual(parts.map(p => p.key), ['intelligence', 'price_out', 'tools'])
  const sum = parts.reduce((s, p) => s + p.points, 0)
  assert.ok(Math.abs(sum - computeGenericScore(m, weights, MAXES)) < 1e-9)
  assert.ok(Math.abs(parts.reduce((s, p) => s + p.maxPoints, 0) - 100) < 1e-9)
})

test('missing benchmark data is a null note worth 0 points', async () => {
  const { scoreBreakdown } = await import('../../src/core/scoring.ts')
  const [intel] = scoreBreakdown({ ...baseModel, intelligence_index: null }, { intelligence: 5 }, MAXES)
  assert.equal(intel.note, null)
  assert.equal(intel.points, 0)
})

test('paretoFrontier keeps only the non-dominated models', async () => {
  const { paretoFrontier } = await import('../../src/core/scoring.ts')
  const pts = [
    { id: 'cheap-weak', cost: 0.1, quality: 30 },
    { id: 'mid', cost: 1, quality: 70 },
    { id: 'dominated', cost: 2, quality: 60 },
    { id: 'premium', cost: 10, quality: 90 },
  ]
  assert.deepEqual(paretoFrontier(pts).map((p: any) => p.id), ['cheap-weak', 'mid', 'premium'])
})

test('a grade never exceeds 100 even above the reference maximum', async () => {
  const { criterionValues } = await import('../../src/core/scoring.ts')
  assert.equal(criterionValues({ ...baseModel, coding_index: 80 }, MAXES).coding, 1)
})

// ── cost per task and measured performance (issue: criteria beyond the indices) ─────────

test('cost per task prices ONE reference task, cache included', () => {
  // Prices are dollars per MILLION tokens, as the catalogue carries them.
  const model = { prompt_price: 3, completion_price: 15, cache_read_price: 0.3 }
  const cached = REFERENCE_TASK.prompt_tokens * REFERENCE_TASK.cache_hit_ratio
  const fresh = REFERENCE_TASK.prompt_tokens - cached
  const expected = (fresh * 3 + cached * 0.3 + REFERENCE_TASK.completion_tokens * 15) / 1_000_000
  assert.equal(Math.round(costPerTask(model)! * 1e9) / 1e9, Math.round(expected * 1e9) / 1e9)
  // 8 000 fresh at $3/M + 12 000 cached at $0.30/M + 2 000 out at $15/M = $0.0576
  assert.ok(Math.abs(costPerTask(model)! - 0.0576) < 1e-9)
})

test('cost per task falls back to the prompt price when no cache price is published', () => {
  const model = { prompt_price: 2, completion_price: 10 }
  assert.equal(Math.round(costPerTask(model)! * 1e9) / 1e9, Math.round(((20_000 * 2 + 2_000 * 10) / 1_000_000) * 1e9) / 1e9)
  assert.equal(costPerTask({ prompt_price: null, completion_price: 1 }), null)
})

test('an unmeasured latency is not the fastest latency in the table', () => {
  const maxes = { maxIntel: 40, maxCoding: 40, maxAgentic: 30, maxPrice: 10, maxPriceCache: 2, maxCtx: 1e6,
    maxSpeed: 200, maxLatency: 10, maxCostTask: 0.1 }
  const measured = { speed_tps: 100, latency_s: 5, prompt_price: 0.000003, completion_price: 0.000015 }
  const unknown = { prompt_price: 0.000003, completion_price: 0.000015 }
  const a = criterionValues(measured, maxes)
  const b = criterionValues(unknown, maxes)
  assert.equal(a.speed, 0.5)
  assert.equal(a.latency, 0.5)
  assert.equal(b.speed, null, 'no throughput published: n/a, not 0')
  assert.equal(b.latency, null, 'no latency published: n/a, never a perfect score')
  assert.ok(b.cost_task! > 0, 'cost per task needs only prices, so it is always available')
})

test('price-derived criteria read "lower is better" on cost per task', () => {
  const maxes = { maxIntel: 40, maxCoding: 40, maxAgentic: 30, maxPrice: 10, maxPriceCache: 2, maxCtx: 1e6,
    maxSpeed: 200, maxLatency: 10, maxCostTask: 0.2 }
  const cheap = criterionValues({ prompt_price: 0.000001, completion_price: 0.000002 }, maxes)
  const dear = criterionValues({ prompt_price: 0.00001, completion_price: 0.00002 }, maxes)
  assert.ok(cheap.cost_task! > dear.cost_task!)
})
