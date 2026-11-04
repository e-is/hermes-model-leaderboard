/**
 * Unit tests for the candidate-list helpers (src/core/candidates.ts): the podium
 * threshold, the scoring pass every list shares, and the filter that keeps a
 * followed model out of the remaining results.
 *
 * Run: node --experimental-strip-types --test tests/unit/candidates.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { scoreCandidates, top3Threshold, untrackedOnly } from '../../src/core/candidates.ts'

const MAXES = {
  maxIntel: 40,
  maxCoding: 40,
  maxAgentic: 30,
  maxPrice: 10,
  maxPriceCache: 2,
  maxCtx: 1_000_000
}

const WEIGHTS = {
  intelligence: 5,
  coding: 0,
  agentic: 0,
  price_in: 0,
  price_out: 0,
  cache_read: 0,
  context: 0,
  tools: 0,
  has_vision: 0,
  open_weights: 0,
  fits_64gb: 0
}

/** Only intelligence is weighted, so the score is exactly index / maxIntel. */
const model = (id: string, intelligence: number) => ({
  id,
  intelligence_index: intelligence,
  coding_index: 0,
  agentic_index: 0,
  prompt_price: 0,
  completion_price: 0,
  cache_read_price: 0,
  context_length: 0
})

// ---- top3Threshold -------------------------------------------------------

test('top3Threshold: no podium without three ranked models', () => {
  assert.equal(top3Threshold([]), 0)
  assert.equal(top3Threshold([90]), 0)
  assert.equal(top3Threshold([90, 80]), 0)
})

test('top3Threshold: three models — third place is the floor', () => {
  assert.equal(top3Threshold([90, 80, 70]), 70)
})

test('top3Threshold: a fourth model lowers the floor, so ties still qualify', () => {
  // 70 and 60 round to the same podium gap: everything at 60 or above is a challenger.
  assert.equal(top3Threshold([90, 80, 70, 60]), 60)
  assert.equal(top3Threshold([90, 80, 70, 70]), 70)
})

test('top3Threshold: scores are compared rounded, as the badge shows them', () => {
  // 69.6 rounds to 70 and 59.4 to 59: the threshold is the rounded pair, not the raw one.
  assert.equal(top3Threshold([90.2, 80.4, 69.6, 59.4]), 59)
})

test('top3Threshold: input order does not matter', () => {
  assert.equal(top3Threshold([60, 90, 70, 80]), top3Threshold([90, 80, 70, 60]))
})

// ---- scoreCandidates -----------------------------------------------------

test('scoreCandidates: scores against the given maxima and keeps the input fields', () => {
  const [full, half] = scoreCandidates([model('a', 40), model('b', 20)], WEIGHTS, MAXES, 0)
  assert.equal(full._score, 100)
  assert.equal(full._roundedScore, 100)
  assert.equal(half._score, 50)
  assert.equal(full.id, 'a')
  assert.equal(full.intelligence_index, 40)
})

test('scoreCandidates: the podium badge needs a threshold and a non-zero score', () => {
  const items = [model('a', 36), model('b', 20)] // 90 and 50
  const withPodium = scoreCandidates(items, WEIGHTS, MAXES, 50)
  assert.deepEqual(withPodium.map(c => c._isChallenger), [true, true])

  const higherPodium = scoreCandidates(items, WEIGHTS, MAXES, 51)
  assert.deepEqual(higherPodium.map(c => c._isChallenger), [true, false])

  // No ranked podium yet (threshold 0): nobody wears the star, not everybody.
  const noPodium = scoreCandidates(items, WEIGHTS, MAXES, 0)
  assert.deepEqual(noPodium.map(c => c._isChallenger), [false, false])

  // A model that scores 0 is never a challenger, whatever the threshold.
  const zero = scoreCandidates([model('z', 0)], WEIGHTS, MAXES, 0)
  assert.equal(zero[0]._isChallenger, false)
})

test('scoreCandidates: empty list, empty result', () => {
  assert.deepEqual(scoreCandidates([], WEIGHTS, MAXES, 70), [])
})

test('scoreCandidates: a profile without weights scores everything 0', () => {
  const noWeights = Object.fromEntries(Object.keys(WEIGHTS).map(k => [k, 0]))
  const [c] = scoreCandidates([model('a', 40)], noWeights, MAXES, 70)
  assert.equal(c._score, 0)
  assert.equal(c._isChallenger, false)
})

// ---- untrackedOnly -------------------------------------------------------

test('untrackedOnly: drops what is already tracked and keeps the rest in order', () => {
  const hits = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  assert.deepEqual(untrackedOnly(hits, new Set(['b'])).map(h => h.id), ['a', 'c'])
  assert.deepEqual(untrackedOnly(hits, ['a', 'c']).map(h => h.id), ['b'])
})

test('untrackedOnly: nothing tracked keeps every hit; everything tracked keeps none', () => {
  const hits = [{ id: 'a' }, { id: 'b' }]
  assert.deepEqual(untrackedOnly(hits, []).map(h => h.id), ['a', 'b'])
  assert.deepEqual(untrackedOnly(hits, new Set(['a', 'b'])), [])
  assert.deepEqual(untrackedOnly([], new Set(['a'])), [])
})
