/**
 * News panel helpers — small pure functions the panel needs and that are worth
 * testing without a DOM (the renderer itself is not unit-tested here).
 */

/**
 * The prices a price-change figure was computed from, as the tooltip on its
 * percentage: `Price in $1.25/M tk · Price out $2.50/M tk`.
 *
 * Empty when the change carries no price (an entry recorded by an older version):
 * the caller then shows no tooltip rather than an empty one. The labels come from
 * the catalogue (never hardcoded), so the sentence follows the UI language.
 */
export function priceChangePrices(
  change: { prompt_price?: number | null; completion_price?: number | null },
  labels: { input: string; output: string },
  formatPrice: (value?: number | null) => string
): string {
  const parts: string[] = []
  if (change.prompt_price != null) {
    parts.push(`${labels.input} ${formatPrice(change.prompt_price)}`)
  }
  if (change.completion_price != null) {
    parts.push(`${labels.output} ${formatPrice(change.completion_price)}`)
  }
  return parts.join(' · ')
}
