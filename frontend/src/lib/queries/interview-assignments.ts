import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  assignRecordingReviewer,
  getInterviewAssignment,
  listRecordingReviewerAssignments,
  setInterviewAssignment,
  unassignAllInterviewers,
  unassignAllRecordingReviewers,
  unassignRecordingReviewer,
} from '@/generated/interview-assignments/interview-assignments'
import { APIError } from '@/lib/api/client'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { Role } from '@/lib/api/types'
import type {
  InterviewAssignment,
  InterviewReviewAssignment,
} from '@/lib/api/types'
import { queryKeys } from './keys'

// The backend 404s when an application has no interviewer assigned yet —
// that's not an error here, just the "unassigned" state.
async function fetchInterviewAssignment(id: string, opts?: RequestOptions) {
  try {
    return (await getInterviewAssignment(id, opts)) as InterviewAssignment
  } catch (err) {
    if (err instanceof APIError && err.status === 404) return undefined
    throw err
  }
}

export function useInterviewAssignment(
  applicationId: string,
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.interviewAssignments.detail(applicationId),
    queryFn: () => fetchInterviewAssignment(applicationId, opts),
    enabled: !!applicationId,
  })
}

// One query per application, sharing cache with useInterviewAssignment — used
// to show current interviewers across a list of applications.
export function useInterviewAssignmentsByApplications(
  applicationIds: string[],
  opts?: RequestOptions
) {
  return useQueries({
    queries: applicationIds.map((id) => ({
      queryKey: queryKeys.interviewAssignments.detail(id),
      queryFn: () => fetchInterviewAssignment(id, opts),
    })),
  })
}

export function useSetInterviewAssignment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      applicationId: string
      interviewerNuid: string
      opts?: RequestOptions
    }) =>
      setInterviewAssignment(
        vars.applicationId,
        { interviewer_nuid: vars.interviewerNuid },
        vars.opts
      ),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.interviewAssignments.detail(vars.applicationId),
      })
    },
  })
}

export function useRecordingReviewerAssignments(
  applicationId: string,
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.interviewReviewAssignments.list(applicationId),
    queryFn: async () =>
      ((await listRecordingReviewerAssignments(applicationId, opts)) ??
        []) as InterviewReviewAssignment[],
    enabled: !!applicationId,
  })
}

// One query per application, sharing cache with useRecordingReviewerAssignments.
export function useRecordingReviewerAssignmentsByApplications(
  applicationIds: string[],
  opts?: RequestOptions
) {
  return useQueries({
    queries: applicationIds.map((id) => ({
      queryKey: queryKeys.interviewReviewAssignments.list(id),
      queryFn: async () =>
        ((await listRecordingReviewerAssignments(id, opts)) ??
          []) as InterviewReviewAssignment[],
    })),
  })
}

export function useAssignRecordingReviewer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      applicationId: string
      leadNuid: string
      opts?: RequestOptions
    }) =>
      assignRecordingReviewer(
        vars.applicationId,
        { lead_nuid: vars.leadNuid },
        vars.opts
      ),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.interviewReviewAssignments.list(vars.applicationId),
      })
    },
  })
}

export function useUnassignRecordingReviewer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      id: string
      applicationId: string
      opts?: RequestOptions
    }) => unassignRecordingReviewer(vars.id, vars.opts),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.interviewReviewAssignments.list(vars.applicationId),
      })
    },
  })
}

// Bulk-clears every interviewer assignment for a cycle × role — a chief
// redoing a botched or outdated run. Every application's interviewer
// assignment is affected, so invalidate the whole namespace rather than
// trying to patch individual application caches.
export function useUnassignAllInterviewers() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      cycleId: string
      role: Role
      opts?: RequestOptions
    }) => unassignAllInterviewers(vars.cycleId, { role: vars.role }, vars.opts),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.interviewAssignments.all,
      })
    },
  })
}

export function useUnassignAllRecordingReviewers() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      cycleId: string
      role: Role
      opts?: RequestOptions
    }) =>
      unassignAllRecordingReviewers(
        vars.cycleId,
        { role: vars.role },
        vars.opts
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.interviewReviewAssignments.all,
      })
    },
  })
}
