import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createChiefReviewComment,
  listChiefReviewComments,
  updateChiefReviewComment,
} from '@/generated/chief-reviews/chief-reviews'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { ChiefReviewComment } from '@/lib/api/types'
import { queryKeys } from './keys'

// A chief's freeform comments on an application, separate from their vote —
// any number per chief, editable by their own author.
export function useChiefReviewComments(
  applicationId: string,
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.chiefReviewComments.list(applicationId),
    queryFn: async () =>
      ((await listChiefReviewComments(applicationId, opts)) ??
        []) as ChiefReviewComment[],
    enabled: !!applicationId,
  })
}

export function useCreateChiefReviewComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      applicationId: string
      body: Parameters<typeof createChiefReviewComment>[1]
      opts?: RequestOptions
    }) => createChiefReviewComment(vars.applicationId, vars.body, vars.opts),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.chiefReviewComments.list(vars.applicationId),
      })
    },
  })
}

export function useUpdateChiefReviewComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      applicationId: string
      commentId: string
      body: Parameters<typeof updateChiefReviewComment>[2]
      opts?: RequestOptions
    }) =>
      updateChiefReviewComment(
        vars.applicationId,
        vars.commentId,
        vars.body,
        vars.opts
      ),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.chiefReviewComments.list(vars.applicationId),
      })
    },
  })
}
