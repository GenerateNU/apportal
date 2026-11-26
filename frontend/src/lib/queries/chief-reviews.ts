import { useMemo } from 'react'
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  createChiefReviewComment,
  listChiefReviewComments,
  listChiefReviewsBulk,
  updateChiefReviewComment,
  upsertChiefReview,
} from '@/generated/chief-reviews/chief-reviews'
import type { ChiefReviewCommentDetail } from '@/generated/model/chiefReviewCommentDetail'
import type { ChiefReviewDetail } from '@/generated/model/chiefReviewDetail'
import type { ChiefVote } from '@/lib/chief-votes'
import { queryKeys } from './keys'

const BATCH = 200

export type ChiefReview = Omit<ChiefReviewDetail, '$schema'>
export type ChiefReviewComment = Omit<ChiefReviewCommentDetail, '$schema'>

export function useChiefReviewsByApplicationIds(applicationIds: string[]) {
  const queryClient = useQueryClient()
  const batches = useMemo(() => {
    const ids = [...new Set(applicationIds)].sort()
    const out: string[][] = []
    for (let i = 0; i < ids.length; i += BATCH)
      out.push(ids.slice(i, i + BATCH))
    return out
  }, [applicationIds])

  const queries = useQueries({
    queries: batches.map((ids) => ({
      queryKey: queryKeys.chiefReviews.bulk(ids),
      queryFn: async () => {
        const rows = ((await listChiefReviewsBulk({
          application_ids: ids.join(','),
        })) ?? []) as ChiefReview[]
        const byApplicationId: Record<string, ChiefReview[]> = {}
        for (const id of ids) byApplicationId[id] = []
        for (const r of rows) byApplicationId[r.application_id]?.push(r)
        for (const [id, list] of Object.entries(byApplicationId)) {
          queryClient.setQueryData(queryKeys.chiefReviews.list(id), list)
        }
        return byApplicationId
      },
    })),
  })

  const data = useMemo(() => {
    const merged: Record<string, ChiefReview[]> = {}
    for (const q of queries) Object.assign(merged, q.data ?? {})
    return merged
  }, [queries])

  return { data, isLoading: queries.some((q) => q.isLoading) }
}

export function useCastChiefVote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: { applicationId: string; vote: ChiefVote }) =>
      upsertChiefReview(vars.applicationId, {
        vote: vars.vote,
      }) as Promise<ChiefReview>,
    onSuccess: (saved, vars) => {
      queryClient.setQueryData<ChiefReview[]>(
        queryKeys.chiefReviews.list(vars.applicationId),
        (prev = []) => [
          ...prev.filter((r) => r.reviewer_nuid !== saved.reviewer_nuid),
          saved,
        ]
      )
      queryClient.invalidateQueries({
        queryKey: queryKeys.chiefReviews.all,
        refetchType: 'all',
      })
    },
  })
}

const commentsKey = (applicationId: string) =>
  [...queryKeys.chiefReviews.all, 'comments', applicationId] as const

export function useChiefReviewComments(applicationId: string) {
  return useQuery({
    queryKey: commentsKey(applicationId),
    queryFn: async () =>
      ((await listChiefReviewComments(applicationId)) ??
        []) as ChiefReviewComment[],
    enabled: !!applicationId,
  })
}

export function useAddChiefReviewComment(applicationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: string) =>
      createChiefReviewComment(applicationId, { body }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: commentsKey(applicationId) }),
  })
}

export function useEditChiefReviewComment(applicationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: { commentId: string; body: string }) =>
      updateChiefReviewComment(applicationId, vars.commentId, {
        body: vars.body,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: commentsKey(applicationId) }),
  })
}
