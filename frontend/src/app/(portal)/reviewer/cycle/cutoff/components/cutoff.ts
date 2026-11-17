import type { ReviewRankingEntry } from '@/generated/model/reviewRankingEntry'
import type { CutoffMode } from '@/lib/queries/review-ranking'

export type CutoffDraft = { mode: CutoffMode | 'none'; value: number }

export function cutoffScore(
  entries: ReviewRankingEntry[],
  draft: CutoffDraft
): number | null {
  if (draft.mode === 'min_score') return draft.value
  if (draft.mode !== 'top_n' || !(draft.value >= 1)) return null
  const scored = entries.filter((e) => e.normalized_score != null)
  return (
    scored[Math.min(draft.value, scored.length) - 1]?.normalized_score ?? null
  )
}

export function previewEntries(
  entries: ReviewRankingEntry[],
  draft: CutoffDraft
) {
  const bar = cutoffScore(entries, draft)
  return entries.map((e) => {
    const above =
      bar != null && e.normalized_score != null && e.normalized_score >= bar
    return { ...e, above_cutoff: above, included: e.override ?? above }
  })
}

export const ADVANCEABLE_STAGES = new Set([
  'submitted',
  'lead_review',
  'chief_review',
])
