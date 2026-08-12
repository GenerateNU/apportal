import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listChiefReviews,
  listChiefReviewsBulk,
  upsertChiefReview,
} from '@/generated/chief-reviews/chief-reviews'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { ChiefReview } from '@/lib/api/types'
import { queryKeys } from './keys'

// A chief's advance/hold decision on an application, made after the lead
// written reviews are in. Unlike written reviews there's no blind-review gate
// — any chief/admin sees every chief review on an application.
export function useChiefReviews(applicationId: string, opts?: RequestOptions) {
  return useQuery({
    queryKey: queryKeys.chiefReviews.list(applicationId),
    queryFn: async () =>
      ((await listChiefReviews(applicationId, opts)) ?? []) as ChiefReview[],
    enabled: !!applicationId,
  })
}

// Fetches chief reviews for a batch of applications in one request instead of
// one per application — e.g. to show each row's vote count in the chief
// review queue. Also writes each application's reviews back into the
// per-application cache entry that useChiefReviews reads, so opening one
// afterwards is a cache hit rather than a fresh request.
export function useChiefReviewsByApplicationIdBatch(
  applicationIds: string[],
  opts?: RequestOptions
) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: queryKeys.chiefReviews.bulk(applicationIds),
    queryFn: async () => {
      const reviews = ((await listChiefReviewsBulk(
        { application_ids: applicationIds.join(',') },
        opts
      )) ?? []) as ChiefReview[]

      const byApplicationId: Record<string, ChiefReview[]> = {}
      for (const id of applicationIds) byApplicationId[id] = []
      for (const review of reviews) {
        byApplicationId[review.application_id]?.push(review)
      }
      for (const [id, list] of Object.entries(byApplicationId)) {
        queryClient.setQueryData(queryKeys.chiefReviews.list(id), list)
      }
      return byApplicationId
    },
    enabled: applicationIds.length > 0,
  })
}

export function useUpsertChiefReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      applicationId: string
      body: Parameters<typeof upsertChiefReview>[1]
      opts?: RequestOptions
    }) => upsertChiefReview(vars.applicationId, vars.body, vars.opts),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.chiefReviews.list(vars.applicationId),
      })
    },
  })
}
