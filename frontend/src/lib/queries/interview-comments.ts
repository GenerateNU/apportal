import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createInterviewComment,
  listInterviewComments,
  updateInterviewComment,
} from '@/generated/interviews/interviews'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { InterviewComment } from '@/lib/api/types'
import { queryKeys } from './keys'

// An open calibration comment thread on an application's interview — unlike
// chief review comments, any reviewer may post here, not just chiefs.
export function useInterviewComments(
  applicationId: string,
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.interviewComments.list(applicationId),
    queryFn: async () =>
      ((await listInterviewComments(applicationId, opts)) ??
        []) as InterviewComment[],
    enabled: !!applicationId,
  })
}

export function useCreateInterviewComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      applicationId: string
      body: Parameters<typeof createInterviewComment>[1]
      opts?: RequestOptions
    }) => createInterviewComment(vars.applicationId, vars.body, vars.opts),
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
      body: Parameters<typeof updateInterviewComment>[2]
      opts?: RequestOptions
    }) =>
      updateInterviewComment(
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
