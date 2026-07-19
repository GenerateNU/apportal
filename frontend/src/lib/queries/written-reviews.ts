import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listWrittenReviews,
  upsertWrittenReview,
} from '@/generated/written-reviews/written-reviews'
import type { WrittenReviewDetail } from '@/generated/model'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import { queryKeys } from './keys'

// A lead's written review of an application. The list is blind: a lead sees only
// their own review until a chief releases the cycle+role (chiefs/admins see all).
export function useWrittenReviews(
  applicationId: string,
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.writtenReviews.list(applicationId),
    queryFn: async () =>
      ((await listWrittenReviews(applicationId, opts)) ??
        []) as WrittenReviewDetail[],
    enabled: !!applicationId,
  })
}

export function useUpsertWrittenReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      applicationId: string
      body: Parameters<typeof upsertWrittenReview>[1]
      opts?: RequestOptions
    }) => upsertWrittenReview(vars.applicationId, vars.body, vars.opts),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.writtenReviews.list(vars.applicationId),
      })
    },
  })
}
