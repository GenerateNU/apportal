import { useQuery } from '@tanstack/react-query'
import { listReviewerProgress } from '@/generated/review-releases/review-releases'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { ReviewerProgress, Role } from '@/lib/api/types'
import { queryKeys } from './keys'

// Shared by the client hook below and the chief review queue's server-side
// prefetch, so both fetch and shape this data identically.
export async function fetchReviewerProgress(
  cycleId: string,
  role?: Role,
  opts?: RequestOptions
): Promise<ReviewerProgress[]> {
  const data = (await listReviewerProgress(cycleId, { role }, opts)) ?? []
  return data.map((p) => ({
    ...p,
    items: p.items ?? [],
  })) as ReviewerProgress[]
}

// Per-lead written-review progress for a cycle × role: every application
// assigned to them and whether it's submitted. Complements useReviewGates'
// cycle-wide aggregate with a per-reviewer breakdown.
export function useReviewerProgress(
  cycleId: string,
  role?: Role,
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.reviewerProgress.list(cycleId, role),
    queryFn: () => fetchReviewerProgress(cycleId, role, opts),
    enabled: !!cycleId && !!role,
  })
}
