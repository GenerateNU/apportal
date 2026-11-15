import type {
  ApplicationTemplate,
  Cycle,
  CycleRoleSummary,
} from '@/lib/api/types'
import type { ApplicationTemplateCard } from '../../applications/components/types'

// One card per template, in the backend's role order, with that role's counts.
export function cycleApplicationCards(
  cycle: Cycle,
  templates: ApplicationTemplate[],
  summaries: CycleRoleSummary[]
): ApplicationTemplateCard[] {
  const summaryByRole = new Map(summaries.map((s) => [s.role_id, s]))
  return templates.map((t) => {
    const summary = summaryByRole.get(t.role_id)
    return {
      cycleId: cycle.id,
      cycleName: cycle.name,
      cycleStatus: cycle.status,
      cycleColorIndex: 0,
      role: t.role_id,
      title: t.title,
      status: t.status,
      questionCount: summary?.question_count ?? 0,
      challengeCount: summary?.challenge_count ?? 0,
      submissionCount: summary?.submission_count ?? 0,
    }
  })
}
