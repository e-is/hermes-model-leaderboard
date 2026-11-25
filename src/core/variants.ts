/**
 * OpenRouter catalogue variants.
 *
 * A suffix such as `:batch` creates its own catalogue entry (`google/gemini-4-neon:batch`), with
 * its own price and context. `:batch` is the same model served asynchronously at half price --
 * Hermes cannot drive it unless a plugin does -- so a profile can leave those entries out of the
 * ranking, the Pareto and the news. `:free` stays in: a good free model must never be penalised
 * for being free.
 *
 * Routing modifiers (`:nitro`, `:floor`, `:exacto`, `:online`) never appear as entries, so an id
 * carrying one is still the base model and must not be stripped.
 */
export const CATALOG_VARIANTS = ['batch', 'free', 'thinking', 'extended'] as const

export type CatalogVariant = (typeof CATALOG_VARIANTS)[number]

/** `poolside/laguna:free:nitro` → `{ variant: 'free', baseId: 'poolside/laguna' }`. */
export function splitVariant(id: string): { variant: CatalogVariant | null; baseId: string } {
  const parts = (id || '').split(':')
  for (let i = 1; i < parts.length; i += 1) {
    if ((CATALOG_VARIANTS as readonly string[]).includes(parts[i])) {
      return { variant: parts[i] as CatalogVariant, baseId: parts.slice(0, i).join(':') }
    }
  }
  return { variant: null, baseId: id }
}

export function isBatch(id: string): boolean {
  return splitVariant(id).variant === 'batch'
}

/** True when the profile asked to leave this entry out (batch only, for now). */
export function excludedByVariant(id: string, excludeBatch: boolean): boolean {
  return Boolean(excludeBatch) && isBatch(id)
}
