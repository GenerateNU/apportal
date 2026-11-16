import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getCycleWorkflow,
  releaseOpeningStep,
  setOpeningDeadline,
  unreleaseOpeningStep,
} from '@/generated/workflow/workflow'
import type { WorkflowChange } from '@/generated/model'
import type { CycleStatus } from '@/lib/api/types'
import { queryKeys } from './keys'

// The caller's layer of the cycle's workflow: leads get steps and their tasks,
// chiefs and admins also get late counts and next actions.
export function useWorkflow(cycleId: string) {
  return useQuery({
    queryKey: queryKeys.workflow.detail(cycleId),
    queryFn: async () => (await getCycleWorkflow(cycleId)) as WorkflowChange,
    enabled: !!cycleId,
  })
}

export type OpeningStep = 'applications' | 'reviews'

const MAIN_KIND = { applications: 'applicant', reviews: 'reviewer' } as const

// Opens, closes or re-drafts one opening's step, or moves its deadline. Closing
// is a deadline of now; reviews keep a soft deadline as a target.
export function useSetOpeningStep() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (vars: {
      cycleId: string
      roleId: string
      step: OpeningStep
      status?: CycleStatus
      dueAt?: string
    }) => {
      const kind = MAIN_KIND[vars.step]
      const deadline = (dueAt: string) =>
        setOpeningDeadline(vars.cycleId, vars.roleId, vars.step, kind, {
          due_at: dueAt,
          hard: vars.step === 'applications',
        })
      if (vars.dueAt) return deadline(vars.dueAt)
      if (vars.status === 'open')
        return releaseOpeningStep(vars.cycleId, vars.roleId, vars.step)
      if (vars.status === 'draft')
        return unreleaseOpeningStep(vars.cycleId, vars.roleId, vars.step)
      return deadline(new Date().toISOString())
    },
    onSuccess: (data, vars) => {
      queryClient.setQueryData(
        queryKeys.workflow.detail(vars.cycleId),
        data as WorkflowChange
      )
      queryClient.invalidateQueries({
        queryKey: queryKeys.applicationTemplates.all,
      })
    },
  })
}
