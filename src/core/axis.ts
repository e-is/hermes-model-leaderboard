/**
 * Axis maths for the quality / cost view.
 *
 * The X axis (weighted cost) is log by default — a linear axis over prices that span
 * $0.01 to $30 presses every cheap model into the first few pixels. Linear stays
 * available as an option, so the two scales need to share one definition of "where
 * does this value sit", and one tick policy each. Pure functions: the chart is
 * rendered without a DOM test, but the geometry is checked here.
 */

export type AxisScale = 'log' | 'linear'

const FLOOR = 1e-9

/** Where a value sits on the axis: 0 = left edge, 1 = right edge, clamped outside. */
export function positionOnAxis(value: number, lo: number, hi: number, scale: AxisScale): number {
  if (!(hi > lo)) return 0
  const clamped = Math.min(hi, Math.max(lo, value))
  if (scale === 'linear') return (clamped - lo) / (hi - lo)
  const l0 = Math.log10(Math.max(lo, FLOOR))
  const l1 = Math.log10(Math.max(hi, lo * 1.0001))
  return (Math.log10(Math.max(clamped, FLOOR)) - l0) / (l1 - l0)
}

/** The 1-3-10 ladder clipped to the domain — the log axis's ticks. */
export function logTicks(ladder: readonly number[], lo: number, hi: number): number[] {
  return ladder.filter(v => v >= lo && v <= hi)
}

/**
 * Evenly spaced round ticks across a linear domain.
 *
 * A linear axis fed the log ladder would bunch most of its labels in the first few
 * percent of the width; this picks a step of 1/2/5×10ⁿ so roughly `target` labels
 * spread over the whole width. Every tick stays inside [lo, hi].
 */
export function linearTicks(lo: number, hi: number, target = 5): number[] {
  if (!(hi > lo)) return [lo]
  const rough = (hi - lo) / target
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const normalised = rough / magnitude
  const stepFactor = normalised >= 5 ? 10 : normalised >= 2 ? 5 : normalised >= 1 ? 2 : 1
  const step = stepFactor * magnitude
  const out: number[] = []
  const first = Math.ceil(lo / step - 1e-9) * step
  for (let v = first; v <= hi + step * 1e-9; v += step) {
    out.push(Number(v.toPrecision(12)))
  }
  return out.length ? out : [lo, hi]
}
