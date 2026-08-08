import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  commitAssignmentPlan,
  getAssignmentPool,
  previewAssignmentPlan,
  suggestAssignmentCapacity,
} from '@/generated/assignment-planning/assignment-planning'
import type { PreviewPlanInputBody, CapacityInputBody } from '@/generated/model'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { Role } from '@/lib/api/types'
import { queryKeys } from './keys'

// Capacity and preview are read-only: they compute a proposal and hand it back
// without touching lead_assignments. They are modelled as mutations because the
// chief drives them from a form (teams are request input, not stored state).
// Only commit writes.

export function useAssignmentPool(
  cycleId: string,
  role: Role,
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.assignmentPlan.pool(cycleId, role),
    queryFn: () => getAssignmentPool(cycleId, { role }, opts),
    enabled: !!cycleId,
  })
}

export function useSuggestCapacity() {
  return useMutation({
    mutationFn: (vars: {
      cycleId: string
      body: CapacityInputBody
      opts?: RequestOptions
    }) => suggestAssignmentCapacity(vars.cycleId, vars.body, vars.opts),
  })
}

export function usePreviewAssignmentPlan() {
  return useMutation({
    mutationFn: (vars: {
      cycleId: string
      body: PreviewPlanInputBody
      opts?: RequestOptions
    }) => previewAssignmentPlan(vars.cycleId, vars.body, vars.opts),
  })
}

// The only write on this page. Assignments now exist, so anything showing a
// lead's queue or an application's reviewers is stale — invalidate broadly
// rather than trying to patch individual application caches.
export function useCommitAssignmentPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      cycleId: string
      body: PreviewPlanInputBody
      opts?: RequestOptions
    }) => commitAssignmentPlan(vars.cycleId, vars.body, vars.opts),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.leadAssignments.all,
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.applications.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.assignmentPlan.all })
    },
  })
}
