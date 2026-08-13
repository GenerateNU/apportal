import { useQuery } from '@tanstack/react-query'
import { listReviewQuestionAverages } from '@/generated/review-releases/review-releases'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { ReviewQuestionAverage, Role } from '@/lib/api/types'
import { queryKeys } from './keys'

// Per-lead average score on each of a cycle × role's score-type review
// questions — a calibration check for whether a lead scores certain
// questions systematically higher or lower than their peers.
export function useReviewQuestionAverages(
  cycleId: string,
  role?: Role,
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.reviewQuestionAverages.list(cycleId, role),
    queryFn: async () => {
      const data =
        (await listReviewQuestionAverages(cycleId, { role }, opts)) ?? []
      return data.map((p) => ({
        ...p,
        scores: p.scores ?? [],
      })) as ReviewQuestionAverage[]
    },
    enabled: !!cycleId && !!role,
  })
}
