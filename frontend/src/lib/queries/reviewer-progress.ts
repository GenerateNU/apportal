import { useQuery } from '@tanstack/react-query'
import { listReviewerProgress } from '@/generated/review-releases/review-releases'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { ReviewerProgress, Role } from '@/lib/api/types'
import { queryKeys } from './keys'

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
    queryFn: async () => {
      const data = (await listReviewerProgress(cycleId, { role }, opts)) ?? []
      return data.map((p) => ({
        ...p,
        items: p.items ?? [],
      })) as ReviewerProgress[]
    },
    enabled: !!cycleId && !!role,
  })
}
