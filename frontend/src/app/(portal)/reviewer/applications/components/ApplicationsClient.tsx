'use client'
import { PageContainer } from '@/components/PageContainer'

import { useMemo, useState } from 'react'
import { Search, List, Columns } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {
  ApplicationStage,
  Question,
  Role,
  WrittenAnswer,
} from '@/lib/api/types'
import { AVAILABILITY_OPTIONS } from '@/lib/availability'
import { useAnswersByApplicationIds } from '@/lib/queries/answers'
import { useApplications } from '@/lib/queries/applications'
import { useCycles } from '@/lib/queries/cycles'
import { useQuestionsByCycleRoles } from '@/lib/queries/questions'
import { ROLE_COLUMNS, ROLE_LABEL } from '@/lib/roles'
import type { ApplicantApplication } from './types'
import { TableView } from './TableView'
import { KanbanView } from './KanbanView'
import { ApplicationDetail } from './ApplicationDetail'

type View = 'table' | 'kanban'

export function ApplicationsClient() {
  const [view, setView] = useState<View>('table')
  const [activeStage, setActiveStage] = useState<ApplicationStage | 'all'>(
    'all'
  )
  const [activeRole, setActiveRole] = useState<Role>(ROLE_COLUMNS[0])
  const [activeCycle, setActiveCycle] = useState<string>('')
  const [cycleDefaulted, setCycleDefaulted] = useState(false)
  const [search, setSearch] = useState('')
  const [activeAvailability, setActiveAvailability] = useState<string | 'all'>(
    'all'
  )
  const [selectedApplicationId, setSelectedApplicationId] = useState<
    string | null
  >(null)

  const { data: cycles = [] } = useCycles({})

  // Default the cycle filter to the cycle currently accepting applications,
  // so reviewers land on the current cycle instead of every cycle ever run.
  // Falls back to whichever cycle opened most recently if none is open
  // (opens_at is only set on scheduled/draft cycles in practice).
  const currentCycleId = useMemo(() => {
    const open = cycles.find((c) => c.status === 'open')
    if (open) return open.id
    let latest: { id: string; opens_at: string } | null = null
    for (const c of cycles) {
      if (c.opens_at && (!latest || c.opens_at > latest.opens_at)) {
        latest = { id: c.id, opens_at: c.opens_at }
      }
    }
    return latest?.id ?? null
  }, [cycles])

  if (!cycleDefaulted && currentCycleId) {
    setActiveCycle(currentCycleId)
    setCycleDefaulted(true)
  }

  // Scoped server-side to the selected cycle+role (both required, so this is
  // always exactly what's on screen) — keeps the question/answer batch below
  // limited to applications actually in view instead of every application.
  const { data: applications = [] } = useApplications(
    activeCycle ? { cycle_id: activeCycle, role: activeRole } : undefined
  )

  const uniquePairs = useMemo(() => {
    const seen = new Set<string>()
    const pairs: { cycleId: string; role: Role }[] = []
    for (const app of applications) {
      const key = `${app.cycle_id}:${app.role}`
      if (!seen.has(key)) {
        seen.add(key)
        pairs.push({ cycleId: app.cycle_id, role: app.role })
      }
    }
    return pairs
  }, [applications])

  const questionQueries = useQuestionsByCycleRoles(uniquePairs)
  const questionsByCycleRole = useMemo(() => {
    const map: Record<string, Question[]> = {}
    uniquePairs.forEach((pair, i) => {
      const data = questionQueries[i]?.data
      if (data) map[`${pair.cycleId}:${pair.role}`] = data
    })
    return map
  }, [uniquePairs, questionQueries])

  const applicationIds = useMemo(
    () => applications.map((a) => a.id),
    [applications]
  )
  const answerQueries = useAnswersByApplicationIds(applicationIds)
  const answersByApplicationId = useMemo(() => {
    const map: Record<string, WrittenAnswer[]> = {}
    applicationIds.forEach((id, i) => {
      const data = answerQueries[i]?.data
      if (data) map[id] = data
    })
    return map
  }, [applicationIds, answerQueries])

  const rows: ApplicantApplication[] = useMemo(
    () =>
      applications.map((app) => ({
        id: app.id,
        nuid: app.user_nuid,
        fullName: app.full_name,
        email: app.email,
        role: app.role,
        cycleId: app.cycle_id,
        stage: app.stage,
        submittedAt: app.submitted_at,
        availability: app.availability,
      })),
    [applications]
  )

  // Everything but the stage filter — used both as the base for `filtered`
  // and as the denominator for the stage tab counts, so those counts track
  // search instead of always reflecting every application in the cycle+role.
  const filteredExceptStage = rows.filter((a) => {
    const query = search.toLowerCase()
    if (query && !a.nuid.includes(query)) return false
    if (activeAvailability !== 'all' && !a.availability?.[activeAvailability]) {
      return false
    }
    return true
  })

  const filtered = filteredExceptStage.filter(
    (a) => view === 'kanban' || activeStage === 'all' || a.stage === activeStage
  )

  // One column per distinct question across the visible rows' cycle/role
  // combinations, ordered the same way the application form displays them —
  // every response the application actually collected, and nothing else
  // (no separate Name/Email columns sourced from the applicant record).
  // Roles within a cycle each get their own copy of common fields (e.g.
  // "First Name") as separate question rows, so we dedupe by text rather
  // than id — otherwise every role duplicates its own column.
  const columns = useMemo(() => {
    const byText = new Map<string, Question>()
    for (const questions of Object.values(questionsByCycleRole)) {
      for (const q of questions) {
        const key = q.question_text.trim().toLowerCase()
        const existing = byText.get(key)
        if (!existing || q.display_order < existing.display_order) {
          byText.set(key, q)
        }
      }
    }
    return [...byText.values()].sort(
      (a, b) =>
        a.display_order - b.display_order ||
        a.created_at.localeCompare(b.created_at)
    )
  }, [questionsByCycleRole])

  return (
    <PageContainer className="flex-1">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-text-default text-2xl font-semibold">
          Applications
        </h1>

        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={activeRole}
            onValueChange={(val) => setActiveRole(val as Role)}
          >
            <SelectTrigger className="w-56" aria-label="Filter by role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_COLUMNS.map((role) => (
                <SelectItem key={role} value={role}>
                  {ROLE_LABEL[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={activeCycle} onValueChange={setActiveCycle}>
            <SelectTrigger className="w-40" aria-label="Filter by cycle">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {cycles.map((cycle) => (
                <SelectItem key={cycle.id} value={cycle.id}>
                  {cycle.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={activeAvailability}
            onValueChange={setActiveAvailability}
          >
            <SelectTrigger className="w-56" aria-label="Filter by availability">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any availability</SelectItem>
              {AVAILABILITY_OPTIONS.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative w-full sm:w-60">
            <Search className="text-text-subtle absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search NUID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="focus:border-brand-blue text-text-default placeholder:text-text-subtle w-full rounded-md border border-gray-200 py-1.5 pr-3 pl-9 text-sm focus:outline-none"
            />
          </div>

          <div className="flex rounded-md border border-gray-200 bg-white">
            <button
              onClick={() => setView('table')}
              className={`rounded-l-md p-1.5 transition-colors ${
                view === 'table'
                  ? 'text-text-default bg-gray-100'
                  : 'text-text-subtle hover:text-text-secondary'
              }`}
              aria-label="Table view"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('kanban')}
              className={`rounded-r-md p-1.5 transition-colors ${
                view === 'kanban'
                  ? 'text-text-default bg-gray-100'
                  : 'text-text-subtle hover:text-text-secondary'
              }`}
              aria-label="Kanban view"
            >
              <Columns className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {view === 'table' ? (
          <TableView
            applicants={filtered}
            allApplicants={filteredExceptStage}
            activeStage={activeStage}
            onStageChange={setActiveStage}
            columns={columns}
            questionsByCycleRole={questionsByCycleRole}
            answersByApplicationId={answersByApplicationId}
            selectedApplicationId={selectedApplicationId}
            onSelectApplication={setSelectedApplicationId}
          />
        ) : (
          <KanbanView applicants={filtered} />
        )}
      </div>

      {selectedApplicationId &&
        (() => {
          const selectedApp = rows.find((a) => a.id === selectedApplicationId)
          return selectedApp ? (
            <ApplicationDetail
              applicant={selectedApp}
              columns={columns}
              rowQuestions={
                questionsByCycleRole[
                  `${selectedApp.cycleId}:${selectedApp.role}`
                ] ?? []
              }
              answers={answersByApplicationId[selectedApplicationId] ?? []}
              onClose={() => setSelectedApplicationId(null)}
            />
          ) : null
        })()}
    </PageContainer>
  )
}
