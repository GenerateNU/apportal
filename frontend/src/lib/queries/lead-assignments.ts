import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  assignLead,
  listLeadAssignments,
  unassignAllLeads,
  unassignLead,
} from '@/generated/lead-assignments/lead-assignments'
import type { LeadAssignment } from '@/generated/model'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { Role } from '@/lib/api/types'
import { queryKeys } from './keys'

export function useLeadAssignments(
  applicationId: string,
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.leadAssignments.list(applicationId),
    queryFn: async () =>
      ((await listLeadAssignments(applicationId, opts)) ??
        []) as LeadAssignment[],
    enabled: !!applicationId,
  })
}

// One query per application, sharing cache with useLeadAssignments — used to
// show current assignees across a list of applications.
export function useLeadAssignmentsByApplications(
  applicationIds: string[],
  opts?: RequestOptions
) {
  return useQueries({
    queries: applicationIds.map((id) => ({
      queryKey: queryKeys.leadAssignments.list(id),
      queryFn: async () =>
        ((await listLeadAssignments(id, opts)) ?? []) as LeadAssignment[],
    })),
  })
}

export function useAssignLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      applicationId: string
      leadNuid: string
      opts?: RequestOptions
    }) =>
      assignLead(vars.applicationId, { lead_nuid: vars.leadNuid }, vars.opts),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.leadAssignments.list(vars.applicationId),
      })
    },
  })
}

export function useUnassignLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      id: string
      applicationId: string
      opts?: RequestOptions
    }) => unassignLead(vars.id, vars.opts),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.leadAssignments.list(vars.applicationId),
      })
    },
  })
}

// Chief-only: remove every written-review lead assignment for one applicant
// role in a cycle at once. Every application's assignment list in the cycle
// may have changed, so this invalidates the whole lead-assignments cache
// rather than one application at a time.
export function useUnassignAllLeads() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      cycleId: string
      role: Role
      opts?: RequestOptions
    }) => unassignAllLeads(vars.cycleId, { role: vars.role }, vars.opts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leadAssignments.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.reviewGates.all })
    },
  })
}
