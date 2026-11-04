/**
 * Candidate lists — the news panel, the promotions and the search results all show
 * *models that are not tracked yet*, ranked against the current profile.
 *
 * They used to each recompute that by hand (score, rounded score, "is this a top-3
 * challenger"), so the same model could read 61 in one list and 60 in another after a
 * rounding change. One place computes it, every list displays it.
 */
// Explicit extension: the unit tests run these modules directly under node's ESM
// resolver, which does not guess '.ts' (esbuild resolves it either way).
import { computeGenericScore } from './scoring.ts'

/** A candidate plus what the lists show about it. */
export type Scored<T> = T & {
  _score: number
  _roundedScore: number
  /** Would enter the podium at the current threshold (the ⭐ / "Top 3" badge). */
  _isChallenger: boolean
}

/**
 * The rounded score a candidate must reach to make the top 3.
 *
 * Third place's score, floored by fourth place's so a tie on the podium does not
 * promote everything below it; 0 when fewer than three models are ranked, which
 * switches the badge off rather than marking everyone as a challenger.
 */
export function top3Threshold(scores: number[]): number {
  if (scores.length < 3) return 0
  const ranked = [...scores].sort((a, b) => b - a).map(s => Math.round(s))
  const third = ranked[2]
  const fourth = ranked.length >= 4 ? ranked[3] : third
  return Math.min(third, fourth)
}

/**
 * Score a candidate list once: same weights, same maxima, same threshold as the
 * tracked table, so the number a model shows here is the number it will keep once
 * the user follows it. Input order is preserved; callers sort if they want.
 */
export function scoreCandidates<T extends Record<string, any>>(
  items: T[],
  weights: Record<string, number>,
  maxes: Record<string, number>,
  threshold: number
): Scored<T>[] {
  return items.map(item => {
    const score = computeGenericScore(item, weights, maxes)
    const rounded = Math.round(score)
    return {
      ...item,
      _score: score,
      _roundedScore: rounded,
      _isChallenger: rounded > 0 && threshold > 0 && rounded >= threshold,
    }
  })
}

/**
 * What a candidate list may still offer: the hits the user has not followed yet.
 * Following one removes its row without touching the rest of the list.
 */
export function untrackedOnly<T extends { id: string }>(
  hits: T[],
  tracked: Set<string> | Iterable<string>
): T[] {
  const ids = tracked instanceof Set ? tracked : new Set(tracked)
  return hits.filter(hit => !ids.has(hit.id))
}
