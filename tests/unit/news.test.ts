/**
 * Unit tests for the news-panel helpers (src/core/news.ts).
 *
 * Run: node --experimental-strip-types --test tests/unit/news.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { priceChangePrices } from '../../src/core/news.ts'

const LABELS = { input: 'Price in', output: 'Price out' }
const fmt = (v?: number | null) => (v == null ? '…' : `$${Number(v).toFixed(2)}/M tk`)

test('priceChangePrices: both prices, in/out order', () => {
  assert.equal(
    priceChangePrices({ prompt_price: 1.25, completion_price: 2.5 }, LABELS, fmt),
    'Price in $1.25/M tk · Price out $2.50/M tk'
  )
})

test('priceChangePrices: a zero price is a price, not a gap', () => {
  assert.equal(
    priceChangePrices({ prompt_price: 0, completion_price: 2.5 }, LABELS, fmt),
    'Price in $0.00/M tk · Price out $2.50/M tk'
  )
})

test('priceChangePrices: only what is known', () => {
  assert.equal(priceChangePrices({ prompt_price: 1.25 }, LABELS, fmt), 'Price in $1.25/M tk')
  assert.equal(priceChangePrices({ completion_price: 2.5 }, LABELS, fmt), 'Price out $2.50/M tk')
})

test('priceChangePrices: no price at all yields an empty caption (no tooltip)', () => {
  assert.equal(priceChangePrices({}, LABELS, fmt), '')
  assert.equal(priceChangePrices({ prompt_price: null, completion_price: null }, LABELS, fmt), '')
})
