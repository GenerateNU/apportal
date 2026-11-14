import { useQueries, useQuery } from '@tanstack/react-query'
import { listReviewerProgress } from '@/generated/review-releases/review-releases'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { ReviewerProgress } from '@/lib/api/types'
import { queryKeys } from './keys'

// Shared by the client hook below and the chief review queue's server-side
// prefetch, so both fetch and shape this data identically.
export async function fetchReviewerProgress(
  cycleId: string,
  roleId?: string,
  opts?: RequestOptions
): Promise<ReviewerProgress[]> {
  const data =
    (await listReviewerProgress(cycleId, { role_id: roleId }, opts)) ?? []
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
  roleId?: string,
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.reviewerProgress.list(cycleId, roleId),
    queryFn: () => fetchReviewerProgress(cycleId, roleId, opts),
    enabled: !!cycleId && !!roleId,
  })
}

// One query per role, in roleIds order — for pages showing every role at once.
export function useReviewerProgressByRoles(
  cycleId: string,
  roleIds: string[],
  opts?: RequestOptions
) {
  return useQueries({
    queries: roleIds.map((roleId) => ({
      queryKey: queryKeys.reviewerProgress.list(cycleId, roleId),
      queryFn: () => fetchReviewerProgress(cycleId, roleId, opts),
      enabled: !!cycleId,
    })),
  })
}
