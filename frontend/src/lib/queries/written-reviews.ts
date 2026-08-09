import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  listWrittenReviews,
  upsertWrittenReview,
} from '@/generated/written-reviews/written-reviews'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { WrittenReviewDetail } from '@/lib/api/types'
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

// Fetches written reviews for a batch of applications, e.g. to show each
// row's submitted state in a review queue. Each id gets its own cache entry,
// shared with useWrittenReviews.
export function useWrittenReviewsByApplicationIds(
  applicationIds: string[],
  opts?: RequestOptions
) {
  return useQueries({
    queries: applicationIds.map((applicationId) => ({
      queryKey: queryKeys.writtenReviews.list(applicationId),
      queryFn: async () =>
        ((await listWrittenReviews(applicationId, opts)) ??
          []) as WrittenReviewDetail[],
    })),
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
