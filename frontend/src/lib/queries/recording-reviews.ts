import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listRecordingReviews,
  listRecordingReviewsBulk,
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

// One request for the whole page of interviews, not one per row — grouped
// by interview_id for callers that need per-application review-progress
// counts. Comments are always redacted here (see the bulk endpoint's own
// doc), so unlike the other bulk hooks this doesn't double as a warm cache
// for the single-interview view.
export function useRecordingReviewsByInterviewIds(
  interviewIds: string[],
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.recordingReviews.bulk(interviewIds),
    queryFn: async () => {
      const reviews = ((await listRecordingReviewsBulk(
        { interview_ids: interviewIds.join(',') },
        opts
      )) ?? []) as InterviewRecordingReview[]

      const byInterviewId: Record<string, InterviewRecordingReview[]> = {}
      for (const id of interviewIds) byInterviewId[id] = []
      for (const review of reviews) {
        const list = byInterviewId[review.interview_id] ?? []
        list.push(review)
        byInterviewId[review.interview_id] = list
      }
      return byInterviewId
    },
    enabled: interviewIds.length > 0,
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
      // Bulk entries are keyed by id list, so there's no one batch to target —
      // drop them all, or a queue that counts this review stays stale.
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.recordingReviews.all, 'bulk'],
      })
    },
  })
}
