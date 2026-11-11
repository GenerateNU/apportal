import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listInterviewReviewers,
  upsertRecordingReview,
} from '@/generated/recording-reviews/recording-reviews'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { InterviewReviewer } from '@/lib/api/types'
import { queryKeys } from './keys'

export function useRecordingReviews(
  applicationId: string,
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.recordingReviews.list(applicationId),
    queryFn: async () =>
      ((await listInterviewReviewers(applicationId, opts)) ??
        []) as InterviewReviewer[],
    enabled: !!applicationId,
  })
}

export function useUpsertRecordingReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      applicationId: string
      body: Parameters<typeof upsertRecordingReview>[1]
      opts?: RequestOptions
    }) => upsertRecordingReview(vars.applicationId, vars.body, vars.opts),
    onSuccess: (data, vars) => {
      queryClient.setQueryData(
        queryKeys.recordingReviews.list(vars.applicationId),
        data
      )
      queryClient.invalidateQueries({
        queryKey: queryKeys.interviewReviewAssignments.all,
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.interviews.all })
    },
  })
}
