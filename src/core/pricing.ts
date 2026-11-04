/**
 * Context-size pricing — pure helpers (no React/SDK), unit-tested in tests/unit/.
 *
 * Some models charge more once the prompt passes a threshold (Claude Haiku 5.5: ×5 above
 * 100 000 tokens). OpenRouter publishes those tiers as `pricing.overrides[].min_prompt_tokens`;
 * the backend normalises them into `model.price_tiers` (ascending, in $/M tokens).
 *
 * A profile may declare the prompt size it typically sends (`context_tokens`). When it does,
 * every price the plugin shows or scores must be the tier that applies — otherwise the
 * ranking silently favours models with a cheap base price and an expensive long context.
 * `null` means "don't know": base prices are used, and the UI shows the tier as a badge.
 */

export type PriceTier = {
  min_prompt_tokens: number
  prompt: number
  completion: number | null
  cache_read?: number | null
  cache_write?: number | null
}

/**
 * The sizes offered in the criteria panel.
 *
 * TODO(dynamic): derive this list from the thresholds actually present in the tracked
 * models' `price_tiers` instead of hard-coding it — a catalogue with a 500k threshold
 * would then appear without a release.
 */
export const CONTEXT_SIZES = [32_000, 100_000, 128_000, 200_000, 1_000_000] as const

/** The tier that applies to `tokens` (largest threshold ≤ tokens), or null for the base price. */
export function tierAt(tiers: PriceTier[] | null | undefined, tokens: number | null | undefined): PriceTier | null {
  if (!tokens || tokens <= 0 || !tiers || tiers.length === 0) return null
  let chosen: PriceTier | null = null
  for (const tier of tiers) {
    if (tier.min_prompt_tokens <= tokens && (!chosen || tier.min_prompt_tokens > chosen.min_prompt_tokens)) {
      chosen = tier
    }
  }
  return chosen
}

export type EffectivePrice = {
  prompt: number | null
  completion: number | null
  cache_read: number | null
  /** The tier applied, null when the base price is in force. */
  tier: PriceTier | null
}

/**
 * Prices to use for a model at a given context size. At or below the first threshold (or with
 * no size declared) the base price applies; above it, the whole request is billed at the tier
 * (Anthropic's long-context rule: not only the tokens past the threshold).
 */
export function effectivePrices(m: any, tokens: number | null | undefined): EffectivePrice {
  const tier = tierAt(m?.price_tiers, tokens)
  const base = {
    prompt: m?.prompt_price ?? null,
    completion: m?.completion_price ?? null,
    cache_read: m?.cache_read_price ?? null,
  }
  if (!tier) return { ...base, tier: null }
  return {
    prompt: tier.prompt,
    completion: tier.completion ?? base.completion,
    cache_read: tier.cache_read ?? base.cache_read,
    tier,
  }
}

/**
 * Whether a model can take a prompt of this size at all. With a size declared, a model whose
 * `context_length` is smaller cannot serve the scenario: it is excluded from the ranking and
 * the Pareto (its price there does not exist), and flagged in the table.
 * No size declared → every model is in scope.
 */
export function servesContext(m: any, tokens: number | null | undefined): boolean {
  if (!tokens || tokens <= 0) return true
  const limit = m?.context_length
  return typeof limit !== 'number' || limit <= 0 || limit >= tokens
}

/** Human label of a size: 32000 → '32k', 1000000 → '1M'. */
export function contextLabel(tokens: number): string {
  if (tokens >= 1_000_000) return `${Math.round(tokens / 1_000_000)}M`
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}k`
  return String(tokens)
}


// ---- context scenario (per profile) --------------------------------------------------

export type ContextMode = 'unknown' | 'auto' | 'size'

/** What the criteria panel stores on a profile. */
export type ContextScenario = { mode: ContextMode; tokens?: number | null }

/** A profile's Hermes compaction settings (backend: /hermes-profiles → compaction). */
export type CompactionConfig = { threshold?: number | null; threshold_tokens?: number | null }

/** Hermes floors the compaction ratio below this window size (raise-only). */
export const WINDOW_FLOOR_AT = 512_000
export const WINDOW_FLOOR_RATIO = 0.75
export const DEFAULT_COMPACTION_THRESHOLD = 0.5

/**
 * The prompt size a profile really reaches with this model, from the profile's Hermes
 * compaction settings: Hermes compacts when the context passes `threshold × window` (floored
 * at 0.75 below a 512K window, raise-only), or at `threshold_tokens` when that absolute cap
 * is set — whichever comes first. It is an estimate of usage, not a guaranteed maximum: one
 * turn can temporarily exceed the trigger, and the provider's window is the hard limit.
 */
export function autoPromptTokens(m: any, compaction?: CompactionConfig | null): number | null {
  const window = Number(m?.context_length) || 0
  if (window <= 0) return null
  let ratio = Number(compaction?.threshold ?? DEFAULT_COMPACTION_THRESHOLD)
  if (!(ratio > 0 && ratio <= 1)) ratio = DEFAULT_COMPACTION_THRESHOLD
  if (window < WINDOW_FLOOR_AT) ratio = Math.max(WINDOW_FLOOR_RATIO, ratio)
  const fromRatio = Math.floor(window * ratio)
  const cap = Number(compaction?.threshold_tokens ?? 0)
  const tokens = cap > 0 ? Math.min(fromRatio, cap) : fromRatio
  return Math.min(tokens, window)
}

/** The prompt size to price a model at, for a profile's scenario. */
export function scenarioTokens(m: any, scenario: ContextScenario | null | undefined,
                               compaction?: CompactionConfig | null): number | null {
  if (!scenario || scenario.mode === 'unknown') return null
  if (scenario.mode === 'auto') return autoPromptTokens(m, compaction)
  return scenario.tokens && scenario.tokens > 0 ? scenario.tokens : null
}

/** `effectivePrices` for a scenario (Auto resolves the size per model first). */
export function effectivePricesFor(m: any, scenario: ContextScenario | null | undefined,
                                   compaction?: CompactionConfig | null): EffectivePrice {
  return effectivePrices(m, scenarioTokens(m, scenario, compaction))
}

/** `servesContext` for a scenario. */
export function servesContextFor(m: any, scenario: ContextScenario | null | undefined,
                                 compaction?: CompactionConfig | null): boolean {
  return servesContext(m, scenarioTokens(m, scenario, compaction))
}
