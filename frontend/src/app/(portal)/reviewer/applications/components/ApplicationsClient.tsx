'use client'
import { PageContainer } from '@/components/PageContainer'

import { useMemo, useState } from 'react'
import { Loader2, Search, List, Columns } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { useAnswersByApplicationIds } from '@/lib/queries/answers'
import {
  useApplications,
  useUpdateApplication,
} from '@/lib/queries/applications'
import { pickDefaultCycleId, useCycles } from '@/lib/queries/cycles'
import { useQuestionsByCycleRoles } from '@/lib/queries/questions'
import { useCurrentUser } from '@/lib/queries/users'
import { ROLE_COLUMNS, ROLE_LABEL } from '@/lib/roles'
import { ORDERED_STAGES, stageLabel } from './constants'
import {
  AVAILABILITY_DAY_OPTIONS,
  availabilityOptionsFor,
  findAvailabilityQuestionId,
  isAvailabilityQuestion,
  shortDays,
} from './meetingAvailability'
import type { ApplicantApplication } from './types'
import { TableView } from './TableView'
import { KanbanView } from './KanbanView'
import { ApplicationDetail } from './ApplicationDetail'

type View = 'table' | 'kanban'

export function ApplicationsClient() {
  const { data: currentUser } = useCurrentUser()
  const isChief = !!currentUser?.roles.some(
    (r) => r === 'chief' || r === 'admin'
  )

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkStage, setBulkStage] = useState<ApplicationStage | ''>('')
  const [applyingBulk, setApplyingBulk] = useState(false)
  const [bulkFailed, setBulkFailed] = useState(0)
  const updateApplication = useUpdateApplication()

  const { data: cycles = [] } = useCycles({})

  // Default the cycle filter so reviewers land on a specific cycle instead
  // of every cycle ever run.
  const currentCycleId = useMemo(
    () => pickDefaultCycleId(cycles) ?? null,
    [cycles]
  )

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
      })),
    [applications]
  )

  // "Meeting Availability for the Fall Semester" is a regular checkbox
  // question authored per cycle/role in the admin builder, not a dedicated
  // field — every application on screen shares one cycle+role, so there's at
  // most one such question in view at a time.
  const availabilityQuestionId = useMemo(
    () =>
      findAvailabilityQuestionId(
        questionsByCycleRole[`${activeCycle}:${activeRole}`]
      ),
    [questionsByCycleRole, activeCycle, activeRole]
  )
  const availabilityByApplicationId = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const app of applications) {
      map[app.id] = shortDays(
        availabilityOptionsFor(
          answersByApplicationId[app.id],
          availabilityQuestionId
        )
      )
    }
    return map
  }, [applications, answersByApplicationId, availabilityQuestionId])

  // Everything but the stage filter — used both as the base for `filtered`
  // and as the denominator for the stage tab counts, so those counts track
  // search instead of always reflecting every application in the cycle+role.
  const filteredExceptStage = rows.filter((a) => {
    const query = search.toLowerCase()
    if (
      query &&
      !a.fullName.toLowerCase().includes(query) &&
      !a.nuid.toLowerCase().includes(query)
    ) {
      return false
    }
    if (
      activeAvailability !== 'all' &&
      !availabilityByApplicationId[a.id]?.includes(activeAvailability)
    ) {
      return false
    }
    return true
  })

  const filtered = filteredExceptStage.filter(
    (a) => view === 'kanban' || activeStage === 'all' || a.stage === activeStage
  )

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const allSelected =
        filtered.length > 0 && filtered.every((a) => prev.has(a.id))
      return allSelected ? new Set() : new Set(filtered.map((a) => a.id))
    })
  }

  async function applyBulkStage() {
    if (!bulkStage || selectedIds.size === 0) return
    setApplyingBulk(true)
    setBulkFailed(0)
    const results = await Promise.allSettled(
      [...selectedIds].map((id) =>
        updateApplication.mutateAsync({ id, body: { stage: bulkStage } })
      )
    )
    const failures = results.filter((r) => r.status === 'rejected').length
    setBulkFailed(failures)
    if (failures === 0) setSelectedIds(new Set())
    setApplyingBulk(false)
  }

  // One column per distinct question across the visible rows' cycle/role
  // combinations, ordered the same way the application form displays them —
  // every response the application actually collected, and nothing else
  // (no separate Name/Email columns sourced from the applicant record).
  // Roles within a cycle each get their own copy of common fields (e.g.
  // "First Name") as separate question rows, so we dedupe by text rather
  // than id — otherwise every role duplicates its own column. Meeting
  // availability gets its own dedicated tag column (below) instead of
  // showing up here as a truncated wall of checkbox text.
  const columns = useMemo(() => {
    const byText = new Map<string, Question>()
    for (const questions of Object.values(questionsByCycleRole)) {
      for (const q of questions) {
        if (isAvailabilityQuestion(q.question_text)) continue
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
              {AVAILABILITY_DAY_OPTIONS.map((option) => (
                <SelectItem key={option.code} value={option.code}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative w-full sm:w-60">
            <Search className="text-text-subtle absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search name or NUID..."
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

      {view === 'table' && isChief && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-white p-4">
          <span className="text-text-faint text-sm">
            {selectedIds.size} selected
          </span>
          {bulkFailed > 0 && (
            <span className="text-destructive text-sm">
              {bulkFailed} update{bulkFailed === 1 ? '' : 's'} failed
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Select
              value={bulkStage}
              onValueChange={(val) => setBulkStage(val as ApplicationStage)}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Move to stage…" />
              </SelectTrigger>
              <SelectContent>
                {ORDERED_STAGES.map((stage) => (
                  <SelectItem key={stage} value={stage}>
                    {stageLabel[stage]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={applyBulkStage}
              disabled={!bulkStage || selectedIds.size === 0 || applyingBulk}
            >
              {applyingBulk ? (
                <>
                  <Loader2 className="animate-spin" size={14} />
                  Updating…
                </>
              ) : (
                `Move ${selectedIds.size || ''} selected`
              )}
            </Button>
          </div>
        </div>
      )}

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
            availabilityByApplicationId={availabilityByApplicationId}
            selectable={isChief}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            selectedApplicationId={selectedApplicationId}
            onSelectApplication={setSelectedApplicationId}
          />
        ) : (
          <KanbanView
            applicants={filtered}
            availabilityByApplicationId={availabilityByApplicationId}
          />
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
