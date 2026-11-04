/**
 * Unit tests for the axis helpers (src/core/axis.ts).
 *
 * Run: node --experimental-strip-types --test tests/unit/axis.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { linearTicks, logTicks, positionOnAxis } from '../../src/core/axis.ts'

const LADDER = [0.01, 0.03, 0.1, 0.3, 1, 3, 10, 30, 100]

// ---- positionOnAxis ------------------------------------------------------

test('positionOnAxis: log places equal ratios at equal distances', () => {
  assert.equal(positionOnAxis(1, 1, 100, 'log'), 0)
  assert.equal(positionOnAxis(10, 1, 100, 'log'), 0.5)
  assert.equal(positionOnAxis(100, 1, 100, 'log'), 1)
  // The whole point of the log axis: a 10× jump is the same width anywhere in the domain.
  const step1 = positionOnAxis(0.1, 0.01, 100, 'log') - positionOnAxis(0.01, 0.01, 100, 'log')
  const step2 = positionOnAxis(1, 0.01, 100, 'log') - positionOnAxis(0.1, 0.01, 100, 'log')
  const step3 = positionOnAxis(100, 0.01, 100, 'log') - positionOnAxis(10, 0.01, 100, 'log')
  assert.ok(Math.abs(step1 - step2) < 1e-12 && Math.abs(step2 - step3) < 1e-12, `${step1} ${step2} ${step3}`)
})

test('positionOnAxis: linear places equal gaps at equal distances', () => {
  assert.equal(positionOnAxis(0, 0, 10, 'linear'), 0)
  assert.equal(positionOnAxis(5, 0, 10, 'linear'), 0.5)
  assert.equal(positionOnAxis(10, 0, 10, 'linear'), 1)
})

test('positionOnAxis: values outside the domain clamp to the edges', () => {
  for (const scale of ['log', 'linear'] as const) {
    assert.equal(positionOnAxis(0.001, 0.01, 30, scale), 0)
    assert.equal(positionOnAxis(9999, 0.01, 30, scale), 1)
  }
})

test('positionOnAxis: a degenerate domain does not divide by zero', () => {
  assert.equal(positionOnAxis(5, 5, 5, 'log'), 0)
  assert.equal(positionOnAxis(5, 5, 5, 'linear'), 0)
  assert.equal(positionOnAxis(0, 0, 0, 'log'), 0)
})

test('positionOnAxis: the two scales disagree in the middle of a wide domain', () => {
  // $1 on a $0.01–$30 axis: 58 % of the log width, 3 % of the linear one.
  const logPos = positionOnAxis(1, 0.01, 30, 'log')
  const linPos = positionOnAxis(1, 0.01, 30, 'linear')
  assert.ok(logPos > 0.5 && logPos < 0.65, `log ${logPos}`)
  assert.ok(linPos < 0.05, `linear ${linPos}`)
})

// ---- logTicks ------------------------------------------------------------

test('logTicks: keeps the ladder values inside the domain, in order', () => {
  assert.deepEqual(logTicks(LADDER, 0.03, 3), [0.03, 0.1, 0.3, 1, 3])
  assert.deepEqual(logTicks(LADDER, 0.01, 100), LADDER)
  assert.deepEqual(logTicks(LADDER, 0.02, 0.08), [0.03])
})

// ---- linearTicks ---------------------------------------------------------

test('linearTicks: inside the domain, ascending, evenly spaced', () => {
  const ticks = linearTicks(0.01, 30)
  assert.ok(ticks.length >= 3, `got ${ticks.length}`)
  assert.deepEqual([...ticks].sort((a, b) => a - b), ticks)
  for (const t of ticks) assert.ok(t >= 0.01 && t <= 30, `${t} outside`)
  const gaps = ticks.slice(1).map((t, i) => t - ticks[i])
  for (const g of gaps) assert.ok(Math.abs(g - gaps[0]) < 1e-9, `uneven gaps ${gaps}`)
})

test('linearTicks: a narrow domain still gets round labels', () => {
  const ticks = linearTicks(1.2, 1.8)
  assert.ok(ticks.length >= 3)
  for (const t of ticks) assert.ok(t >= 1.2 && t <= 1.8 && Number.isFinite(t), `${t}`)
})

test('linearTicks: degenerate and inverted domains do not loop forever', () => {
  assert.deepEqual(linearTicks(5, 5), [5])
  assert.deepEqual(linearTicks(10, 1), [10])
})

test('linearTicks: unlike the log ladder, it does not bunch labels at the left', () => {
  const ticks = linearTicks(0.01, 30)
  const positions = ticks.map(t => positionOnAxis(t, 0.01, 30, 'linear'))
  const gaps = positions.slice(1).map((p, i) => p - positions[i])
  // Every gap is the same fraction of the width (equal spacing is the point).
  for (const g of gaps) assert.ok(Math.abs(g - gaps[0]) < 1e-9, `gaps ${gaps}`)
})
