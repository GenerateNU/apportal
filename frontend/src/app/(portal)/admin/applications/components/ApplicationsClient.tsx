'use client'

import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useApplications } from '@/lib/queries/applications'
import { useChallengesByCycles } from '@/lib/queries/challenges'
import { useCycles } from '@/lib/queries/cycles'
import { useQuestionsByCycles } from '@/lib/queries/questions'
import { ROLE_COLUMNS } from '@/lib/roles'
import { REVIEWER_ACTOR } from '@/lib/stub-actor'
import type { ApplicationTemplateCard } from './types'
import { ApplicationBoard } from './ApplicationBoard'
import { AddCycleDialog } from './AddCycleDialog'

export function ApplicationsClient() {
  const [showAddCycle, setShowAddCycle] = useState(false)
  const { data: cycles = [] } = useCycles({ actor: REVIEWER_ACTOR })
  const { data: applications = [] } = useApplications(
    {},
    { actor: REVIEWER_ACTOR }
  )

  const cycleIds = useMemo(() => cycles.map((c) => c.id), [cycles])
  const questionQueries = useQuestionsByCycles(cycleIds, {
    actor: REVIEWER_ACTOR,
  })
  const challengeQueries = useChallengesByCycles(cycleIds, {
    actor: REVIEWER_ACTOR,
  })

  const questionsByCycle = useMemo(() => {
    const map: Record<string, (typeof questionQueries)[number]['data']> = {}
    cycleIds.forEach((id, i) => {
      map[id] = questionQueries[i]?.data
    })
    return map
  }, [cycleIds, questionQueries])

  const challengesByCycle = useMemo(() => {
    const map: Record<string, (typeof challengeQueries)[number]['data']> = {}
    cycleIds.forEach((id, i) => {
      map[id] = challengeQueries[i]?.data
    })
    return map
  }, [cycleIds, challengeQueries])

  const templates: ApplicationTemplateCard[] = useMemo(() => {
    const result: ApplicationTemplateCard[] = []
    cycles.forEach((cycle, cycleColorIndex) => {
      const questions = questionsByCycle[cycle.id] ?? []
      const challenges = challengesByCycle[cycle.id] ?? []
      for (const role of ROLE_COLUMNS) {
        result.push({
          cycleId: cycle.id,
          cycleName: cycle.name,
          cycleStatus: cycle.status,
          cycleColorIndex,
          opensAt: cycle.opens_at ?? null,
          closesAt: cycle.closes_at ?? null,
          role,
          questionCount: questions.filter(
            (q) => q.role === role || q.role === null
          ).length,
          challengeCount: challenges.filter((c) => c.role === role).length,
          submissionCount: applications.filter(
            (a) => a.cycle_id === cycle.id && a.role === role
          ).length,
        })
      }
    })
    return result
  }, [cycles, questionsByCycle, challengesByCycle, applications])

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-start justify-between">
        <h1 className="text-text-default text-2xl font-semibold">
          Applications
        </h1>
        <Button variant="outline" onClick={() => setShowAddCycle(true)}>
          <Plus className="h-4 w-4" />
          Add cycle
        </Button>
      </div>

      <ApplicationBoard templates={templates} />

      <AddCycleDialog open={showAddCycle} onOpenChange={setShowAddCycle} />
    </div>
  )
}
