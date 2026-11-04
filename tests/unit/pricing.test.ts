/**
 * tests for src/core/pricing.ts — context-size tiers.
 *
 * Fixture: Claude Haiku 5.5 as OpenRouter publishes it ($0.10/$0.50 up to 100k tokens,
 * ×5 above). Thresholds are on prompt tokens, so the boundary is the interesting part.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  CONTEXT_SIZES,
  autoPromptTokens,
  contextLabel,
  effectivePrices,
  effectivePricesFor,
  scenarioTokens,
  servesContext,
  servesContextFor,
  tierAt,
} from '../../src/core/pricing.ts'

const HAIKU_55 = {
  context_length: 1_000_000,
  prompt_price: 0.1,
  completion_price: 0.5,
  cache_read_price: 0.01,
  price_tiers: [{
    min_prompt_tokens: 100_000,
    prompt: 0.5,
    completion: 2.5,
    cache_read: 0.05,
    cache_write: 0.625,
  }],
}

const PLAIN = { context_length: 128_000, prompt_price: 0.2, completion_price: 0.8, price_tiers: [] }

test('tierAt applies the base price below the threshold, the tier from it', () => {
  assert.equal(tierAt(HAIKU_55.price_tiers, null), null)
  assert.equal(tierAt(HAIKU_55.price_tiers, 99_999), null)
  assert.equal(tierAt(HAIKU_55.price_tiers, 100_000)?.prompt, 0.5) // threshold is inclusive
  assert.equal(tierAt(HAIKU_55.price_tiers, 400_000)?.prompt, 0.5)
})

test('tierAt picks the highest threshold at or below the size', () => {
  const tiers = [
    { min_prompt_tokens: 32_000, prompt: 1, completion: 2 },
    { min_prompt_tokens: 256_000, prompt: 2, completion: 4 },
  ]
  assert.equal(tierAt(tiers, 40_000)?.prompt, 1)
  assert.equal(tierAt(tiers, 256_000)?.prompt, 2)
  assert.equal(tierAt(tiers, 1_000_000)?.prompt, 2)
})

test('tierAt tolerates a malformed or missing tier list', () => {
  assert.equal(tierAt(undefined, 200_000), null)
  assert.equal(tierAt([], 200_000), null)
  assert.equal(tierAt(null, 200_000), null)
})

test('effectivePrices swaps input, output and cache prices at the tier', () => {
  const base = effectivePrices(HAIKU_55, null)
  assert.deepEqual([base.prompt, base.completion, base.cache_read, base.tier], [0.1, 0.5, 0.01, null])

  const long = effectivePrices(HAIKU_55, CONTEXT_SIZES[2]) // 128k
  assert.deepEqual([long.prompt, long.completion, long.cache_read], [0.5, 2.5, 0.05])
  assert.equal(long.tier?.min_prompt_tokens, 100_000)

  const small = effectivePrices(HAIKU_55, 32_000)
  assert.deepEqual([small.prompt, small.completion], [0.1, 0.5])
})

test('effectivePrices leaves a model without tiers untouched', () => {
  const p = effectivePrices(PLAIN, 128_000)
  assert.deepEqual([p.prompt, p.completion, p.tier], [0.2, 0.8, null])
})

test('effectivePrices keeps the base output price when a tier omits it', () => {
  const m = { ...PLAIN, price_tiers: [{ min_prompt_tokens: 32_000, prompt: 1, completion: null }] }
  const p = effectivePrices(m, 50_000)
  assert.deepEqual([p.prompt, p.completion], [1, 0.8])
})

test('servesContext flags a model that cannot take the chosen size', () => {
  const haiku45 = { context_length: 200_000 }
  assert.equal(servesContext(haiku45, null), true) // no size chosen → everyone is in scope
  assert.equal(servesContext(haiku45, 128_000), true)
  assert.equal(servesContext(haiku45, 1_000_000), false)
  assert.equal(servesContext(HAIKU_55, 1_000_000), true)
  assert.equal(servesContext({ context_length: null }, 1_000_000), true) // unknown limit: don't guess
})

test('contextLabel renders the sizes the panel offers', () => {
  assert.deepEqual(CONTEXT_SIZES.map(contextLabel), ['32k', '100k', '128k', '200k', '1M'])
})


// ---- Auto mode: the profile's Hermes compaction settings --------------------------------

test('autoPromptTokens mirrors the compaction trigger, floored below a 512K window', () => {
  // 200K window: Hermes raises the 50 % ratio to 75 % (raise-only floor) → 150K.
  assert.equal(autoPromptTokens({ context_length: 200_000 }, { threshold: 0.5 }), 150_000)
  // 1M window: no floor → 50 % → 500K, which crosses Haiku 5.5's 100K tier.
  assert.equal(autoPromptTokens({ context_length: 1_000_000 }, { threshold: 0.5 }), 500_000)
  // A ratio already above the floor is used as-is.
  assert.equal(autoPromptTokens({ context_length: 200_000 }, { threshold: 0.9 }), 180_000)
  // Absolute cap wins when it is lower.
  assert.equal(autoPromptTokens({ context_length: 1_000_000 }, { threshold: 0.5, threshold_tokens: 48_000 }), 48_000)
  // No window → nothing to compute.
  assert.equal(autoPromptTokens({ context_length: null }, { threshold: 0.5 }), null)
})

test('autoPromptTokens falls back to the Hermes defaults on a missing or silly config', () => {
  assert.equal(autoPromptTokens({ context_length: 400_000 }, undefined), 300_000) // 0.75 floor
  assert.equal(autoPromptTokens({ context_length: 400_000 }, { threshold: 3 }), 300_000)
})

test('scenarioTokens reads the three modes', () => {
  const m = { context_length: 1_000_000 }
  assert.equal(scenarioTokens(m, { mode: 'unknown' }), null)
  assert.equal(scenarioTokens(m, { mode: 'size', tokens: 128_000 }), 128_000)
  assert.equal(scenarioTokens(m, { mode: 'size', tokens: null }), null)
  assert.equal(scenarioTokens(m, { mode: 'auto' }, { threshold: 0.5 }), 500_000)
})

test('auto mode prices Haiku 5.5 at its long-context tier', () => {
  const p = effectivePricesFor(HAIKU_55, { mode: 'auto' }, { threshold: 0.5 })
  assert.equal(p.tier?.min_prompt_tokens, 100_000)
  assert.deepEqual([p.prompt, p.completion], [0.5, 2.5])
})

test('servesContextFor keeps every model in scope when no size is declared', () => {
  const small = { context_length: 128_000 }
  assert.equal(servesContextFor(small, { mode: 'unknown' }), true)
  assert.equal(servesContextFor(small, { mode: 'size', tokens: 200_000 }), false)
  assert.equal(servesContextFor(small, { mode: 'auto' }, { threshold: 0.5 }), true) // 96K of 128K
})
