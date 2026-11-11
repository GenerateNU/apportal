import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  addInterviewer,
  addInterviewerBulk,
  assignRecordingReviewer,
  listInterviewAssignments,
  listInterviewAssignmentsBulk,
  listInterviewReviewAssignmentsBulk,
  listRecordingReviewerAssignments,
  unassignAllInterviewers,
  unassignAllRecordingReviewers,
  unassignInterviewer,
  unassignRecordingReviewer,
} from '@/generated/interview-assignments/interview-assignments'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { Role } from '@/lib/api/types'
import type {
  InterviewAssignment,
  InterviewReviewAssignment,
} from '@/lib/api/types'
import { queryKeys } from './keys'

export function useInterviewAssignments(
  applicationId: string,
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.interviewAssignments.detail(applicationId),
    queryFn: async () =>
      ((await listInterviewAssignments(applicationId, opts)) ??
        []) as InterviewAssignment[],
    enabled: !!applicationId,
  })
}

export function useInterviewAssignmentsBulk(
  applicationIds: string[],
  opts?: RequestOptions
) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: queryKeys.interviewAssignments.bulk(applicationIds),
    queryFn: async () => {
      const assignments = ((await listInterviewAssignmentsBulk(
        { application_ids: applicationIds.join(',') },
        opts
      )) ?? []) as InterviewAssignment[]

      const byApplicationId: Record<string, InterviewAssignment[]> = {}
      for (const id of applicationIds) byApplicationId[id] = []
      for (const assignment of assignments) {
        const list = byApplicationId[assignment.application_id] ?? []
        list.push(assignment)
        byApplicationId[assignment.application_id] = list
      }
      for (const [id, list] of Object.entries(byApplicationId)) {
        queryClient.setQueryData(
          queryKeys.interviewAssignments.detail(id),
          list
        )
      }
      return byApplicationId
    },
    enabled: applicationIds.length > 0,
  })
}

export function useAddInterviewer() {
  const queryClient = useQueryClient()
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
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.interviewAssignments.all,
      })
    },
  })
}

const MAX_BULK_APPLICATIONS = 200

export function useAddInterviewerBulk() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (vars: {
      applicationIds: string[]
      interviewerNuid: string
      opts?: RequestOptions
    }) => {
      const chunks: string[][] = []
      for (
        let i = 0;
        i < vars.applicationIds.length;
        i += MAX_BULK_APPLICATIONS
      ) {
        chunks.push(vars.applicationIds.slice(i, i + MAX_BULK_APPLICATIONS))
      }
      return Promise.all(
        chunks.map((applicationIds) =>
          addInterviewerBulk(
            {
              application_ids: applicationIds,
              interviewer_nuid: vars.interviewerNuid,
            },
            vars.opts
          )
        )
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.interviewAssignments.all,
      })
    },
  })
}

export function useUnassignInterviewer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; opts?: RequestOptions }) =>
      unassignInterviewer(vars.id, vars.opts),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.interviewAssignments.all,
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

// One request for the whole page of applications, instead of one per row —
// mirrors useInterviewAssignmentsBulk above.
export function useRecordingReviewerAssignmentsBulk(
  applicationIds: string[],
  opts?: RequestOptions
) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: queryKeys.interviewReviewAssignments.bulk(applicationIds),
    queryFn: async () => {
      const assignments = ((await listInterviewReviewAssignmentsBulk(
        { application_ids: applicationIds.join(',') },
        opts
      )) ?? []) as InterviewReviewAssignment[]

      const byApplicationId: Record<string, InterviewReviewAssignment[]> = {}
      for (const id of applicationIds) byApplicationId[id] = []
      for (const assignment of assignments) {
        const list = byApplicationId[assignment.application_id] ?? []
        list.push(assignment)
        byApplicationId[assignment.application_id] = list
      }
      for (const [id, list] of Object.entries(byApplicationId)) {
        queryClient.setQueryData(
          queryKeys.interviewReviewAssignments.list(id),
          list
        )
      }
      return byApplicationId
    },
    enabled: applicationIds.length > 0,
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
