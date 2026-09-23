/**
 * Unit tests for the pure scoring helpers (src/core/scoring.ts).
 *
 * Run: node --experimental-strip-types --test tests/unit/scoring.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { computeGenericScore } from '../../src/core/scoring.ts'

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
    open_weights: 1, fits_64gb: 1, tools_vision: 1
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
