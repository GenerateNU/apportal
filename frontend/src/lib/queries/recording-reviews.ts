import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listRecordingReviews,
  upsertRecordingReview,
} from '@/generated/recording-reviews/recording-reviews'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { InterviewRecordingReview } from '@/lib/api/types'
import { queryKeys } from './keys'

export function useRecordingReviews(
  interviewId: string,
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.recordingReviews.list(interviewId),
    queryFn: async () =>
      ((await listRecordingReviews(interviewId, opts)) ??
        []) as InterviewRecordingReview[],
    enabled: !!interviewId,
  })
}

export function useUpsertRecordingReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      interviewId: string
      body: Parameters<typeof upsertRecordingReview>[1]
      opts?: RequestOptions
    }) => upsertRecordingReview(vars.interviewId, vars.body, vars.opts),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.recordingReviews.list(vars.interviewId),
      })
    },
  })
}
