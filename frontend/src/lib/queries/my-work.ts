import type { Task } from '@/generated/model/task'
import { useWorkflow } from './workflow'

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
  {
    id: 'draft',
    label: 'Draft',
    kinds: ['draft'],
    locked: 'The draft starts once decisions open',
  },
  {
    id: 'feedback',
    label: 'Feedback',
    kinds: ['feedback'],
    locked: 'Feedback opens after decisions',
  },
]

export function phasesFrom(tasks: Task[]): MyWorkPhase[] {
  return PHASES.map((p) => {
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
}

export function useMyWork(cycleId: string) {
  const q = useWorkflow(cycleId)
  return {
    ...q,
    data: q.data ? phasesFrom(q.data.tasks ?? []) : undefined,
  }
}

export function currentPhase(phases: MyWorkPhase[]) {
  return (
    phases.find((p) => p.status === 'open') ??
    [...phases].reverse().find((p) => p.status !== 'locked')
  )
}
