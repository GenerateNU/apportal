import { useQuery } from '@tanstack/react-query'
import { getMyCyclePipeline } from '@/generated/pipeline/pipeline'
import type { MyPipeline } from '@/generated/model/myPipeline'
import type { StepView } from '@/generated/model/stepView'
import type { Task } from '@/generated/model/task'
import { queryKeys } from './keys'

export type MyWorkPhaseId =
  | 'reviews'
  | 'interviews'
  | 'interviewReviews'
  | 'preference'
  | 'draft'
  | 'feedback'

export type MyWorkPhase = {
  id: MyWorkPhaseId
  label: string
  status: 'locked' | 'open' | 'done'
  locked_reason?: string
  deadline?: string
  done: number
  total: number
}

const PHASES: {
  id: MyWorkPhaseId
  label: string
  kinds: Task['kind'][]
  locked: string
}[] = [
  {
    id: 'reviews',
    label: 'Reviews',
    kinds: ['review'],
    locked: 'Reviews open once chiefs release them',
  },
  {
    id: 'interviews',
    label: 'Interviews',
    kinds: ['interview'],
    locked: 'Interviews open once chiefs release them',
  },
  {
    id: 'interviewReviews',
    label: 'Recording reviews',
    kinds: ['recording_review'],
    locked: 'Recording reviews open once interviews are released',
  },
  {
    id: 'preference',
    label: 'Preference lists',
    kinds: ['preference_list'],
    locked: 'Preference lists open after interviews',
  },
]

const STEP_PHASES: {
  id: MyWorkPhaseId
  label: string
  step: StepView['step']
  locked: string
}[] = [
  {
    id: 'draft',
    label: 'Draft',
    step: 'decisions',
    locked: 'The draft starts once decisions open',
  },
  {
    id: 'feedback',
    label: 'Feedback',
    step: 'feedback',
    locked: 'Feedback opens after decisions',
  },
]

export function phasesFrom(tasks: Task[], steps: StepView[]): MyWorkPhase[] {
  const fromTasks = PHASES.map((p) => {
    const mine = tasks.filter((t) => p.kinds.includes(t.kind))
    const open = mine.filter((t) => t.status === 'open')
    const due = open
      .map((t) => t.due_at)
      .filter((d): d is string => !!d)
      .sort()[0]
    const status: MyWorkPhase['status'] =
      open.length > 0
        ? 'open'
        : mine.length > 0 && mine.every((t) => t.status === 'done')
          ? 'done'
          : 'locked'
    return {
      id: p.id,
      label: p.label,
      status,
      locked_reason:
        status === 'locked'
          ? (mine.find((t) => t.locked_reason)?.locked_reason ?? p.locked)
          : undefined,
      deadline: due,
      done: mine.reduce((n, t) => n + t.done, 0),
      total: mine.reduce((n, t) => n + t.total, 0),
    }
  })
  const fromSteps = STEP_PHASES.map((p): MyWorkPhase => {
    const status = steps.find((s) => s.step === p.step)?.status ?? 'locked'
    return {
      id: p.id,
      label: p.label,
      status,
      locked_reason: status === 'locked' ? p.locked : undefined,
      done: 0,
      total: 0,
    }
  })
  return [...fromTasks, ...fromSteps]
}

export function useMyPipeline(cycleId: string) {
  return useQuery({
    queryKey: queryKeys.myWork.detail(cycleId),
    queryFn: async () => (await getMyCyclePipeline(cycleId)) as MyPipeline,
    enabled: !!cycleId,
  })
}

export function useMyWork(cycleId: string) {
  const q = useMyPipeline(cycleId)
  return {
    ...q,
    data: q.data
      ? phasesFrom(q.data.tasks ?? [], q.data.steps ?? [])
      : undefined,
  }
}

export function currentPhase(phases: MyWorkPhase[]) {
  return (
    phases.find((p) => p.status === 'open') ??
    [...phases].reverse().find((p) => p.status !== 'locked')
  )
}
