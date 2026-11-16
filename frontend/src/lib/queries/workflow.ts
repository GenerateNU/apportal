import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  advanceCycleStep,
  completeCycleStep,
  getCycleWorkflow,
  listCycleSteps,
  releaseOpeningStep,
  removeStepAssignment,
  setCycleStep,
  setOpeningDeadline,
  setStepAssignment,
  unreleaseOpeningStep,
} from '@/generated/workflow/workflow'
import type { Overview, StepConfig, WorkflowChange } from '@/generated/model'
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
      for (const queryKey of [
        queryKeys.applicationTemplates.all,
        queryKeys.cycles.all,
      ])
        queryClient.invalidateQueries({ queryKey })
    },
  })
}

export type StepName = StepConfig['step']
export type DeadlineKind =
  | 'applicant'
  | 'reviewer'
  | 'interviewer'
  | 'recording_reviewer'
  | 'preference_list'
export type AssignmentKind = 'reviewer' | 'interviewer' | 'recording_reviewer'

export function useCycleSteps(cycleId: string) {
  return useQuery({
    queryKey: queryKeys.workflow.steps(cycleId),
    queryFn: async () =>
      ((await listCycleSteps(cycleId)) ?? []) as StepConfig[],
    enabled: !!cycleId,
  })
}

export function stepConfig(steps: StepConfig[], step: StepName) {
  return steps.find((s) => s.step === step)
}

export function perApplicant(
  steps: StepConfig[],
  step: StepName,
  kind: AssignmentKind
) {
  return (
    (stepConfig(steps, step)?.assignments ?? []).find((a) => a.kind === kind)
      ?.per_applicant ?? 0
  )
}

export function openingIn(
  view: Overview | undefined,
  step: StepName,
  roleId: string
) {
  return view?.steps
    ?.find((s) => s.step === step)
    ?.openings?.find((o) => o.role_id === roleId)
}

export function dueAt(
  view: Overview | undefined,
  step: StepName,
  roleId: string,
  kind: DeadlineKind
) {
  return openingIn(view, step, roleId)?.deadlines?.find((d) => d.kind === kind)
    ?.due_at
}

export function released(
  view: Overview | undefined,
  step: StepName,
  roleId: string
) {
  return !!openingIn(view, step, roleId)?.released_at
}

function useInvalidateWorkflow(cycleId: string) {
  const queryClient = useQueryClient()
  return () =>
    Promise.all(
      [
        queryKeys.workflow.detail(cycleId),
        queryKeys.workflow.steps(cycleId),
        queryKeys.applications.all,
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey }))
    )
}

export function useWorkflowMutations(cycleId: string) {
  const onSuccess = useInvalidateWorkflow(cycleId)
  return {
    setEnabled: useMutation({
      mutationFn: (vars: { step: StepName; enabled: boolean }) =>
        setCycleStep(cycleId, vars.step, { enabled: vars.enabled }),
      onSuccess,
    }),
    setPerApplicant: useMutation({
      mutationFn: (vars: {
        step: StepName
        kind: AssignmentKind
        perApplicant: number | null
      }) =>
        vars.perApplicant
          ? setStepAssignment(cycleId, vars.step, vars.kind, {
              per_applicant: vars.perApplicant,
            })
          : removeStepAssignment(cycleId, vars.step, vars.kind),
      onSuccess,
    }),
    setDeadline: useMutation({
      mutationFn: (vars: {
        roleId: string
        step: StepName
        kind: DeadlineKind
        dueAt: string
        hard?: boolean
      }) =>
        setOpeningDeadline(cycleId, vars.roleId, vars.step, vars.kind, {
          due_at: vars.dueAt,
          hard: vars.hard,
        }),
      onSuccess,
    }),
    release: useMutation({
      mutationFn: (vars: {
        roleId: string
        step: StepName
        released: boolean
      }) =>
        vars.released
          ? releaseOpeningStep(cycleId, vars.roleId, vars.step)
          : unreleaseOpeningStep(cycleId, vars.roleId, vars.step),
      onSuccess,
    }),
    advance: useMutation({
      mutationFn: (vars: {
        step: StepName
        applicationIds: string[]
        roleId?: string
      }) =>
        advanceCycleStep(cycleId, vars.step, {
          application_ids: vars.applicationIds,
          role_id: vars.roleId,
        }),
      onSuccess,
    }),
    complete: useMutation({
      mutationFn: (step: StepName) => completeCycleStep(cycleId, step),
      onSuccess,
    }),
  }
}
