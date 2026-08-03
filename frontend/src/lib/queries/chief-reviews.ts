import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  listChiefReviews,
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

// One query per application, sharing cache with useChiefReviews — e.g. to
// find which applications a chief has marked as advancing to interview.
export function useChiefReviewsByApplications(
  applicationIds: string[],
  opts?: RequestOptions
) {
  return useQueries({
    queries: applicationIds.map((id) => ({
      queryKey: queryKeys.chiefReviews.list(id),
      queryFn: async () =>
        ((await listChiefReviews(id, opts)) ?? []) as ChiefReview[],
    })),
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
