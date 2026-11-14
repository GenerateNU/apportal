import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import {
  addInterviewReviewer,
  addInterviewer,
  listInterviewReviewersBulk,
  removeInterviewReviewer,
  removeInterviewer,
  unassignAllInterviewReviewers,
  unassignAllInterviewers,
} from '@/generated/interview-assignments/interview-assignments'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { InterviewReviewer, Role } from '@/lib/api/types'
import { chunkIds } from './interviews'
import { queryKeys } from './keys'

function useInvalidateInterviewers() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.interviews.all })
    queryClient.invalidateQueries({ queryKey: queryKeys.applications.lists() })
    queryClient.invalidateQueries({ queryKey: queryKeys.decisions.all })
  }
}

function useInvalidateReviewers() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.interviews.all })
    queryClient.invalidateQueries({
      queryKey: queryKeys.interviewReviewAssignments.all,
    })
    queryClient.invalidateQueries({ queryKey: queryKeys.recordingReviews.all })
    queryClient.invalidateQueries({ queryKey: queryKeys.decisions.all })
  }
}

export function useAddInterviewer() {
  const invalidate = useInvalidateInterviewers()
  return useMutation({
    mutationFn: (vars: {
      applicationId: string
      interviewerNuid: string
      opts?: RequestOptions
    }) =>
      addInterviewer(
        vars.applicationId,
        { interviewer_nuid: vars.interviewerNuid },
        vars.opts
      ),
    onSuccess: invalidate,
  })
}

export function useRemoveInterviewer() {
  const invalidate = useInvalidateInterviewers()
  return useMutation({
    mutationFn: (vars: { id: string; opts?: RequestOptions }) =>
      removeInterviewer(vars.id, vars.opts),
    onSuccess: invalidate,
  })
}

export function useInterviewReviewersBulk(
  applicationIds: string[],
  opts?: RequestOptions
) {
  const batches = useMemo(() => chunkIds(applicationIds), [applicationIds])
  const queries = useQueries({
    queries: batches.map((ids) => ({
      queryKey: queryKeys.interviewReviewAssignments.bulk(ids),
      queryFn: async () => {
        const reviewers = ((await listInterviewReviewersBulk(
          { application_ids: ids.join(',') },
          opts
        )) ?? []) as InterviewReviewer[]
        const byApplicationId: Record<string, InterviewReviewer[]> = {}
        for (const id of ids) byApplicationId[id] = []
        for (const reviewer of reviewers) {
          byApplicationId[reviewer.application_id]?.push(reviewer)
        }
        return byApplicationId
      },
    })),
  })
  const data = useMemo(() => {
    if (queries.some((q) => !q.data)) return undefined
    return Object.assign({}, ...queries.map((q) => q.data)) as Record<
      string,
      InterviewReviewer[]
    >
  }, [queries])
  return { data, isLoading: queries.some((q) => q.isLoading) }
}

export function useAddInterviewReviewer() {
  const invalidate = useInvalidateReviewers()
  return useMutation({
    mutationFn: (vars: {
      applicationId: string
      reviewerNuid: string
      opts?: RequestOptions
    }) =>
      addInterviewReviewer(
        vars.applicationId,
        { reviewer_nuid: vars.reviewerNuid },
        vars.opts
      ),
    onSuccess: invalidate,
  })
}

export function useRemoveInterviewReviewer() {
  const invalidate = useInvalidateReviewers()
  return useMutation({
    mutationFn: (vars: { id: string; opts?: RequestOptions }) =>
      removeInterviewReviewer(vars.id, vars.opts),
    onSuccess: invalidate,
  })
}

export function useUnassignAllInterviewers() {
  const invalidate = useInvalidateInterviewers()
  return useMutation({
    mutationFn: (vars: {
      cycleId: string
      role: Role
      opts?: RequestOptions
    }) => unassignAllInterviewers(vars.cycleId, { role: vars.role }, vars.opts),
    onSuccess: invalidate,
  })
}

export function useUnassignAllInterviewReviewers() {
  const invalidate = useInvalidateReviewers()
  return useMutation({
    mutationFn: (vars: {
      cycleId: string
      role: Role
      opts?: RequestOptions
    }) =>
      unassignAllInterviewReviewers(
        vars.cycleId,
        { role: vars.role },
        vars.opts
      ),
    onSuccess: invalidate,
  })
}
