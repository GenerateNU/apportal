import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  commitInterviewerPlan,
  commitInterviewReviewerPlan,
  getInterviewerPool,
  getInterviewReviewerPool,
  previewInterviewerPlan,
  previewInterviewReviewerPlan,
  suggestInterviewerCapacity,
  suggestInterviewReviewerCapacity,
} from '@/generated/interview-assignment-planning/interview-assignment-planning'
import type {
  InterviewerCapacityInputBody,
  InterviewerPreviewInputBody,
  ReviewerCapacityInputBody,
  ReviewerPreviewInputBody,
} from '@/generated/model'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { Role } from '@/lib/api/types'
import { queryKeys } from './keys'

// Same pattern as assignment-plan.ts: capacity and preview are read-only, but
// modelled as mutations since the chief drives them from a form (the
// meeting-day roster is request input, not stored state). Only commit writes.

export function useInterviewerPool(
  cycleId: string,
  role: Role,
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.interviewAssignmentPlan.interviewerPool(cycleId, role),
    queryFn: async () => {
      const pool = await getInterviewerPool(cycleId, { role }, opts)
      return { ...pool, applicants: pool.applicants ?? [] }
    },
    enabled: !!cycleId,
  })
}

export function useSuggestInterviewerCapacity() {
  return useMutation({
    mutationFn: (vars: {
      cycleId: string
      body: InterviewerCapacityInputBody
      opts?: RequestOptions
    }) => suggestInterviewerCapacity(vars.cycleId, vars.body, vars.opts),
  })
}

export function usePreviewInterviewerPlan() {
  return useMutation({
    mutationFn: (vars: {
      cycleId: string
      body: InterviewerPreviewInputBody
      opts?: RequestOptions
    }) => previewInterviewerPlan(vars.cycleId, vars.body, vars.opts),
  })
}

// The only write in the interviewer stage. Interviewer assignments now exist,
// so the reviewer stage's pool (and anything showing an application's
// interviewer) is stale — invalidate broadly.
export function useCommitInterviewerPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      cycleId: string
      body: InterviewerPreviewInputBody
      opts?: RequestOptions
    }) => commitInterviewerPlan(vars.cycleId, vars.body, vars.opts),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.interviewAssignments.all,
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.applications.all })
      queryClient.invalidateQueries({
        queryKey: queryKeys.interviewAssignmentPlan.all,
      })
    },
  })
}

export function useInterviewReviewerPool(
  cycleId: string,
  role: Role,
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.interviewAssignmentPlan.reviewerPool(cycleId, role),
    queryFn: async () => {
      const pool = await getInterviewReviewerPool(cycleId, { role }, opts)
      return { ...pool, applicants: pool.applicants ?? [] }
    },
    enabled: !!cycleId,
  })
}

export function useSuggestInterviewReviewerCapacity() {
  return useMutation({
    mutationFn: (vars: {
      cycleId: string
      body: ReviewerCapacityInputBody
      opts?: RequestOptions
    }) => suggestInterviewReviewerCapacity(vars.cycleId, vars.body, vars.opts),
  })
}

export function usePreviewInterviewReviewerPlan() {
  return useMutation({
    mutationFn: (vars: {
      cycleId: string
      body: ReviewerPreviewInputBody
      opts?: RequestOptions
    }) => previewInterviewReviewerPlan(vars.cycleId, vars.body, vars.opts),
  })
}

export function useCommitInterviewReviewerPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      cycleId: string
      body: ReviewerPreviewInputBody
      opts?: RequestOptions
    }) => commitInterviewReviewerPlan(vars.cycleId, vars.body, vars.opts),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.interviewReviewAssignments.all,
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.interviewAssignmentPlan.all,
      })
    },
  })
}
