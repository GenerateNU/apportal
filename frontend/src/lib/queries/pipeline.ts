import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  advanceCycleStep,
  completeCycleStep,
  getCyclePipeline,
  listCycleSteps,
  releaseOpeningStep,
  removeStepAssignment,
  setCycleStep,
  setOpeningDeadline,
  setStepAssignment,
  unreleaseOpeningStep,
} from '@/generated/pipeline/pipeline'
import type { StepConfig } from '@/generated/model/stepConfig'
import type { View } from '@/generated/model/view'
import { queryKeys } from './keys'

export type StepName = StepConfig['step']
export type DeadlineKind =
  'applicant' | 'reviewer' | 'interviewer' | 'recording_reviewer'
export type AssignmentKind = Exclude<DeadlineKind, 'applicant'>

export function usePipeline(cycleId: string) {
  return useQuery({
    queryKey: queryKeys.pipeline.detail(cycleId),
    queryFn: async () => (await getCyclePipeline(cycleId)) as View,
    enabled: !!cycleId,
  })
}

export function useCycleSteps(cycleId: string) {
  return useQuery({
    queryKey: queryKeys.pipeline.steps(cycleId),
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
  view: View | undefined,
  step: StepName,
  roleId: string
) {
  return view?.steps
    ?.find((s) => s.step === step)
    ?.openings?.find((o) => o.role_id === roleId)
}

export function dueAt(
  view: View | undefined,
  step: StepName,
  roleId: string,
  kind: DeadlineKind
) {
  return openingIn(view, step, roleId)?.deadlines?.find((d) => d.kind === kind)
    ?.due_at
}

export function released(
  view: View | undefined,
  step: StepName,
  roleId: string
) {
  return !!openingIn(view, step, roleId)?.released_at
}

function useInvalidatePipeline(cycleId: string) {
  const queryClient = useQueryClient()
  return () =>
    Promise.all(
      [
        queryKeys.pipeline.detail(cycleId),
        queryKeys.pipeline.steps(cycleId),
        queryKeys.myWork.all,
        queryKeys.applications.all,
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey }))
    )
}

export function usePipelineMutations(cycleId: string) {
  const onSuccess = useInvalidatePipeline(cycleId)
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
