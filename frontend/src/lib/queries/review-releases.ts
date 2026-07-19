import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listReviewGates,
  setReviewRelease,
} from '@/generated/review-releases/review-releases'
import type { ReviewGate } from '@/generated/model'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import { queryKeys } from './keys'

// The blind-review gate per cycle: one entry per applicant role × review kind
// (written, recording), with submission progress and whether reviews are
// released to all reviewers.
export function useReviewGates(cycleId: string, opts?: RequestOptions) {
  return useQuery({
    queryKey: queryKeys.reviewGates.list(cycleId),
    queryFn: async () =>
      ((await listReviewGates(cycleId, opts)) ?? []) as ReviewGate[],
    enabled: !!cycleId,
  })
}

// Chief-only: release (reveal to everyone) or hide a cycle's reviews for a role.
export function useSetReviewRelease() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      cycleId: string
      body: Parameters<typeof setReviewRelease>[1]
      opts?: RequestOptions
    }) => setReviewRelease(vars.cycleId, vars.body, vars.opts),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.reviewGates.list(vars.cycleId),
      })
      // Releasing changes what other reviewers' written-review lists return.
      queryClient.invalidateQueries({
        queryKey: queryKeys.writtenReviews.all,
      })
    },
  })
}
