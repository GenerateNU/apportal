import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useMemo } from 'react'
import {
  listWrittenReviews,
  listWrittenReviewsBulk,
  upsertWrittenReview,
} from '@/generated/written-reviews/written-reviews'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { WrittenReviewDetail } from '@/lib/api/types'
import { chunkIds, MAX_BULK_APPLICATIONS } from './interviews'
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

export function useWrittenReviewsByApplicationIds(
  applicationIds: string[],
  opts?: RequestOptions
) {
  const queryClient = useQueryClient()
  const batches = useMemo(() => chunkIds(applicationIds), [applicationIds])
  const queries = useQueries({
    queries: batches.map((batch) => ({
      queryKey: queryKeys.writtenReviews.bulk(batch),
      queryFn: async () => {
        const reviews = ((await listWrittenReviewsBulk(
          { application_ids: batch.join(',') },
          opts
        )) ?? []) as WrittenReviewDetail[]
        const byApplicationId: Record<string, WrittenReviewDetail[]> = {}
        for (const id of batch) byApplicationId[id] = []
        for (const review of reviews) {
          byApplicationId[review.application_id]?.push(review)
        }
        for (const [id, list] of Object.entries(byApplicationId)) {
          queryClient.setQueryData(queryKeys.writtenReviews.list(id), list)
        }
        return byApplicationId
      },
      enabled: batch.length > 0,
    })),
  })
  return useMemo(
    () =>
      applicationIds.map((id, i) => {
        const q = queries[Math.floor(i / MAX_BULK_APPLICATIONS)]
        return {
          data: q?.data?.[id],
          isLoading: q?.isLoading ?? false,
          isPending: q?.isPending ?? true,
          isError: q?.isError ?? false,
        }
      }),
    [applicationIds, queries]
  )
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
      queryClient.invalidateQueries({
        queryKey: queryKeys.writtenReviews.bulks(),
        predicate: (query) =>
          (query.queryKey[2] as string[]).includes(vars.applicationId),
      })
    },
  })
}
