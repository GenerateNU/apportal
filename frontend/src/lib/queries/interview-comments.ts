import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createApplicationComment,
  listApplicationComments,
  updateApplicationComment,
} from '@/generated/application-comments/application-comments'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { InterviewComment } from '@/lib/api/types'
import { queryKeys } from './keys'

export function useInterviewComments(
  applicationId: string,
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.interviewComments.list(applicationId),
    queryFn: async () =>
      ((await listApplicationComments(applicationId, opts)) ??
        []) as InterviewComment[],
    enabled: !!applicationId,
  })
}

export function useCreateInterviewComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      applicationId: string
      body: Parameters<typeof createApplicationComment>[1]
      opts?: RequestOptions
    }) => createApplicationComment(vars.applicationId, vars.body, vars.opts),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.interviewComments.list(vars.applicationId),
      })
    },
  })
}

export function useUpdateInterviewComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      applicationId: string
      commentId: string
      body: Parameters<typeof updateApplicationComment>[2]
      opts?: RequestOptions
    }) =>
      updateApplicationComment(
        vars.applicationId,
        vars.commentId,
        vars.body,
        vars.opts
      ),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.interviewComments.list(vars.applicationId),
      })
    },
  })
}
