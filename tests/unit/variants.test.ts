/**
 * Catalogue variants: :batch is a separate entry (asynchronous, half price) that a profile may
 * exclude; :free stays in. Routing modifiers are part of the base model's id and must survive.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { excludedByVariant, isBatch, splitVariant } from '../../src/core/variants.ts'

test('splits a catalogue variant off the base id', () => {
  assert.deepEqual(splitVariant('google/gemini-4-neon:batch'),
    { variant: 'batch', baseId: 'google/gemini-4-neon' })
  assert.deepEqual(splitVariant('inclusionai/ling-3.2-flash:free'),
    { variant: 'free', baseId: 'inclusionai/ling-3.2-flash' })
})

test('leaves plain ids and routing modifiers alone', () => {
  assert.deepEqual(splitVariant('openai/gpt-5.2'), { variant: null, baseId: 'openai/gpt-5.2' })
  assert.deepEqual(splitVariant('openai/gpt-5.2:nitro'), { variant: null, baseId: 'openai/gpt-5.2:nitro' })
  assert.deepEqual(splitVariant('poolside/laguna:free:nitro'),
    { variant: 'free', baseId: 'poolside/laguna' })
})

test('only batch is excluded, and only when the profile asks', () => {
  assert.equal(isBatch('openai/gpt-6.2:batch'), true)
  assert.equal(isBatch('openai/gpt-6.2'), false)
  assert.equal(excludedByVariant('openai/gpt-6.2:batch', true), true)
  assert.equal(excludedByVariant('openai/gpt-6.2:batch', false), false)
  // a free model must never be penalised for being free
  assert.equal(excludedByVariant('inclusionai/ling-3.2-flash:free', true), false)
})
