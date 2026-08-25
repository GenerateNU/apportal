'use client'
import { PageContainer } from '@/components/PageContainer'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { usePersistedFilters } from '@/hooks/usePersistedFilters'
import { useAnswersByApplicationIdBatches } from '@/lib/queries/answers'
import {
  useInfiniteApplications,
  useUpdateApplication,
} from '@/lib/queries/applications'
import { pickDefaultCycleId, useCycles } from '@/lib/queries/cycles'
import { useQuestionsByCycleRoles } from '@/lib/queries/questions'
import { useCurrentUser } from '@/lib/queries/users'
import { ROLE_COLUMNS, ROLE_LABEL } from '@/lib/roles'
import { RATING_OPTIONS } from '@/lib/interview-ratings'
import { ORDERED_STAGES, PAGE_SIZE, stageLabel } from './constants'
import { BulkActionBar } from './BulkActionBar'
import {
  AVAILABILITY_DAY_OPTIONS,
  availabilityOptionsFor,
  findAvailabilityQuestionId,
  shortDays,
} from './meetingAvailability'
import type { ApplicantApplication } from './types'
import type { AnswerFilter, FilterChangeHandler } from './FilterButton'
import { TableView } from './TableView'
import { KanbanView } from './KanbanView'
import { ApplicationDetail } from './ApplicationDetail'

type View = 'table' | 'kanban'

// How long typing settles before the search hits the server. Long enough that
// a typed word is one request, short enough to still feel live.
const SEARCH_DEBOUNCE_MS = 250

// Persisted across visits (not just in-session) so leaving the table to look
// at an applicant and coming back doesn't reset a filter set that took several
// chips to build. Versioned, like the chief-review queue's key: if a default
// below ever changes, bump this so the old one can't resurrect itself.
const FILTERS_STORAGE_KEY = 'applications-filters-v1'

type StoredFilters = {
  view: View
  cycleId: string
  role: Role
  stage: ApplicationStage | 'all'
  search: string
  filters: AnswerFilter[]
}

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
  const [selectedApplicationId, setSelectedApplicationId] = useState<
    string | null
  >(null)
  const [filters, setFilters] = useState<AnswerFilter[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkStage, setBulkStage] = useState<ApplicationStage | ''>('')
  const [applyingBulk, setApplyingBulk] = useState(false)
  const [bulkFailed, setBulkFailed] = useState(0)
  const updateApplication = useUpdateApplication()

  // The search box stays instant while the request it drives waits for a
  // pause in typing.
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedSearch(search),
      SEARCH_DEBOUNCE_MS
    )
    return () => clearTimeout(timer)
  }, [search])

  const { data: cycles = [] } = useCycles({})

  // Default the cycle filter so reviewers land on a specific cycle instead
  // of every cycle ever run. Shared with the server prefetch in ../page.tsx,
  // which scopes its application-list prefetch to this same cycle.
  const currentCycleId = useMemo(
    () => pickDefaultCycleId(cycles) ?? null,
    [cycles]
  )

  if (!cycleDefaulted && currentCycleId) {
    setActiveCycle(currentCycleId)
    setCycleDefaulted(true)
  }

  // Every stored value can outlive what it points at — a cycle can be removed,
  // a role retired — so each is checked against the current options and
  // otherwise left at its default.
  const restoreFilters = useCallback(
    (stored: Partial<StoredFilters>) => {
      if (stored.view === 'table' || stored.view === 'kanban') {
        setView(stored.view)
      }
      if (stored.cycleId && cycles.some((c) => c.id === stored.cycleId)) {
        setActiveCycle(stored.cycleId)
        setCycleDefaulted(true)
      }
      if (stored.role && ROLE_COLUMNS.includes(stored.role)) {
        setActiveRole(stored.role)
      }

      const stage =
        stored.stage &&
        ORDERED_STAGES.includes(stored.stage as ApplicationStage)
          ? (stored.stage as ApplicationStage)
          : 'all'
      if (stage !== 'all') setActiveStage(stage)
      if (Array.isArray(stored.filters)) {
        // The stage tabs and the stage chip say the same thing two ways and
        // only one is ever live (see handleStageChange) — a snapshot holding
        // both is stale, and the tab is what's visible.
        setFilters(
          stage === 'all'
            ? stored.filters
            : stored.filters.filter((f) => f.special !== 'stage')
        )
      }

      // Both, so a restored term doesn't fire a second query a debounce later.
      if (stored.search) {
        setSearch(stored.search)
        setDebouncedSearch(stored.search)
      }
    },
    [cycles]
  )

  // Held back until the cycle list is in hand, since a stored cycle id is only
  // safe to apply once there's something to check it against. The debounced
  // search rather than the live one, so typing doesn't write once per keystroke.
  usePersistedFilters<StoredFilters>(
    FILTERS_STORAGE_KEY,
    {
      view,
      cycleId: activeCycle,
      role: activeRole,
      stage: activeStage,
      search: debouncedSearch,
      filters,
    },
    restoreFilters,
    cycles.length > 0
  )

  // Taken from the selected cycle+role rather than from the results, since a
  // filter that matches nothing would otherwise empty the question list the
  // filter UI itself is built from. Every application in view is this pair.
  const uniquePairs = useMemo(
    () => (activeCycle ? [{ cycleId: activeCycle, role: activeRole }] : []),
    [activeCycle, activeRole]
  )

  const questionQueries = useQuestionsByCycleRoles(uniquePairs)
  const questionsByCycleRole = useMemo(() => {
    const map: Record<string, Question[]> = {}
    uniquePairs.forEach((pair, i) => {
      const data = questionQueries[i]?.data
      if (data) map[`${pair.cycleId}:${pair.role}`] = data
    })
    return map
  }, [uniquePairs, questionQueries])

  // A restored chip — or one left behind by a role switch — can point at a
  // question the current cycle/role doesn't have, which empties the table with
  // nothing on screen to explain it. Only prune once the questions are loaded;
  // doing it while they're pending would drop every chip. Specials are
  // synthetic questions (__rating__ and friends) and always apply.
  const questionsLoaded =
    uniquePairs.length > 0 && questionQueries.every((q) => q.isSuccess)
  const knownQuestionIds = useMemo(
    () =>
      Object.values(questionsByCycleRole)
        .flat()
        .map((q) => q.id)
        .sort()
        .join(','),
    [questionsByCycleRole]
  )
  useEffect(() => {
    if (!questionsLoaded) return
    const known = new Set(knownQuestionIds.split(','))
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilters((prev) => {
      const next = prev.filter((f) => f.special || known.has(f.question_id))
      return next.length === prev.length ? prev : next
    })
  }, [questionsLoaded, knownQuestionIds])

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

  // The chip picks whole days, but the stored answer holds the full option
  // label ("Monday 6:00-7:30 PM") and the wording drifts between cycles.
  // Expanding each day to the matching labels here — where the options are
  // already loaded — keeps the server filter an exact any-of match and keeps
  // it consistent with the day tags in the table, which come from the same
  // list.
  const availabilityFilter = useMemo(() => {
    const chip = filters.find((f) => f.special === 'availability')
    if (!chip || !availabilityQuestionId) return null
    const labels = Array.isArray(chip.values) ? chip.values : [chip.values]
    const days = AVAILABILITY_DAY_OPTIONS.filter((d) =>
      labels.includes(d.label)
    )
    const options =
      questionsByCycleRole[`${activeCycle}:${activeRole}`]?.find(
        (q) => q.id === availabilityQuestionId
      )?.options ?? []
    const values = options.filter((o) =>
      days.some((d) => o.toLowerCase().includes(d.day))
    )
    if (values.length === 0) return null
    return {
      question_id: availabilityQuestionId,
      question_type: 'checkbox' as const,
      values,
    }
  }, [
    filters,
    availabilityQuestionId,
    questionsByCycleRole,
    activeCycle,
    activeRole,
  ])

  // Every filter is applied in SQL, so the page the table renders is already
  // the answer — nothing below narrows it further. That is what makes the
  // totals and the stage counts trustworthy: they describe the same match,
  // counted server-side over every row rather than the page in hand.
  const listParams = useMemo(() => {
    if (!activeCycle) return undefined
    // Rating and stage travel as their own query params; the availability
    // chip is expanded into an answer filter above; question filters go as-is.
    const ratingFilters = filters.filter((f) => f.special === 'rating')
    const stageFilters = filters.filter((f) => f.special === 'stage')
    const questionFilters = filters.filter((f) => !f.special)

    const answerFilters = [
      ...questionFilters.map((f) => ({
        question_id: f.question_id,
        question_type: f.question_type,
        values: f.values,
      })),
      ...(availabilityFilter ? [availabilityFilter] : []),
    ]

    // Convert rating filter values back to rating enum values
    const ratingValues = ratingFilters.flatMap((f) => {
      const vals = Array.isArray(f.values) ? f.values : [f.values]
      return vals
        .map((label) => {
          const rating = RATING_OPTIONS.find((r) => r.label === label)
          return rating?.value
        })
        .filter(Boolean)
    })

    // Labels are what the checkbox list shows; the API takes the enum values.
    const stageValues = stageFilters.flatMap((f) =>
      (Array.isArray(f.values) ? f.values : [f.values])
        .map((label) => ORDERED_STAGES.find((s) => stageLabel[s] === label))
        .filter(Boolean)
    )

    return {
      cycle_id: activeCycle,
      role: activeRole,
      ...(debouncedSearch && { search: debouncedSearch }),
      // Each of these is omitted when inactive so an unfiltered first page
      // keys identically to the server prefetch in ../page.tsx.
      ...(answerFilters.length > 0 && { answer_filters: answerFilters }),
      ...(ratingValues.length > 0 && {
        rating_filters: ratingValues.join(','),
      }),
      // Unlike the stage tabs below, this one holds in kanban too — it's an
      // explicit chip, and dropping it silently would contradict the UI.
      ...(stageValues.length > 0 && { stages: stageValues.join(',') }),
      // Kanban lays every stage out side by side, so it can neither filter by
      // one stage nor take a page — it asks for the whole set instead.
      ...(view === 'table' && {
        ...(activeStage !== 'all' && { stage: activeStage }),
        limit: PAGE_SIZE,
      }),
    }
  }, [
    activeCycle,
    activeRole,
    activeStage,
    debouncedSearch,
    filters,
    availabilityFilter,
    view,
  ])

  const {
    applications,
    applicationIdPages,
    stageCounts,
    isFetching: fetchingApplications,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteApplications(listParams)

  // One request per loaded page rather than one per row.
  const answerQueries = useAnswersByApplicationIdBatches(applicationIdPages)
  const answersByApplicationId = useMemo(() => {
    const map: Record<string, WrittenAnswer[]> = {}
    for (const query of answerQueries) {
      Object.assign(map, query.data ?? {})
    }
    return map
  }, [answerQueries])

  // A whole page's answers land at once, so every row in it shares its
  // batch's state. Cells read this to stay blank until then rather than
  // reporting "No response" for an answer nobody has looked up yet.
  const answersLoadingByApplicationId = useMemo(() => {
    const map: Record<string, boolean> = {}
    applicationIdPages.forEach((ids, i) => {
      const pending = answerQueries[i]?.isPending ?? true
      for (const id of ids) map[id] = pending
    })
    return map
  }, [applicationIdPages, answerQueries])

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

  // No client-side narrowing left: search, availability, and stage are all in
  // the query above, so these rows are the page as the database returned it.
  // Kanban is the exception — it groups by stage itself, so it asks for the
  // unpaged set separately below.
  const filtered = rows

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // The stage tabs and the stage filter chip say the same thing two ways, so
  // only one is ever live — picking either clears the other.
  function handleStageChange(stage: ApplicationStage | 'all') {
    setActiveStage(stage)
    setFilters((prev) => prev.filter((f) => f.special !== 'stage'))
  }

  const handleFilterChange: FilterChangeHandler = (filter, action) => {
    if (!filter) return
    if (action === 'remove') {
      setFilters((prev) =>
        prev.filter((f) => f.question_id !== filter.question_id)
      )
      return
    }
    if (filter.special === 'stage') setActiveStage('all')
    // Editing keeps the chip where it is; adding appends.
    setFilters((prev) =>
      action === 'update'
        ? prev.map((f) => (f.question_id === filter.question_id ? filter : f))
        : [...prev, filter]
    )
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const allSelected =
        filtered.length > 0 && filtered.every((a) => prev.has(a.id))
      return allSelected ? new Set() : new Set(filtered.map((a) => a.id))
    })
  }

  // Dropping the selection also drops the bar's transient state, so a failure
  // notice from a previous batch can't linger into the next one.
  function clearSelection() {
    setSelectedIds(new Set())
    setBulkStage('')
    setBulkFailed(0)
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
  // than id — otherwise every role duplicates its own column. This is the
  // full set; the table drops meeting availability on its own, since only it
  // has somewhere else to show it.
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

  // min-h-0 is what makes the table's own pane the scroll container: without
  // it this flex item can't shrink below its content, so it grows to the
  // table's full height and the ancestor in (portal)/layout.tsx scrolls
  // instead — which leaves the sticky header with no scrollport to pin against.
  return (
    <PageContainer className="min-h-0 flex-1 overflow-hidden">
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

      <div className="flex min-h-0 flex-1 flex-col">
        {view === 'table' ? (
          <TableView
            applicants={filtered}
            stageCounts={stageCounts}
            activeStage={activeStage}
            onStageChange={handleStageChange}
            columns={columns}
            questionsByCycleRole={questionsByCycleRole}
            answersByApplicationId={answersByApplicationId}
            answersLoadingByApplicationId={answersLoadingByApplicationId}
            availabilityByApplicationId={availabilityByApplicationId}
            selectable={isChief}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            selectedApplicationId={selectedApplicationId}
            onSelectApplication={setSelectedApplicationId}
            filters={filters}
            onFilterChange={handleFilterChange}
            hasAvailability={!!availabilityQuestionId}
            bulkBar={
              isChief && selectedIds.size > 0 ? (
                <BulkActionBar
                  selectedCount={selectedIds.size}
                  stage={bulkStage}
                  onStageChange={setBulkStage}
                  onApply={applyBulkStage}
                  onClear={clearSelection}
                  applying={applyingBulk}
                  failedCount={bulkFailed}
                />
              ) : undefined
            }
            // Only dim for a fresh query, not for the append — the rows
            // already on screen stay put while the next chunk loads.
            loading={fetchingApplications && !isFetchingNextPage}
            hasMore={hasNextPage}
            loadingMore={isFetchingNextPage}
            onLoadMore={fetchNextPage}
          />
        ) : (
          <KanbanView
            applicants={filtered}
            availabilityByApplicationId={availabilityByApplicationId}
            editable={isChief}
          />
        )}
      </div>

      {selectedApplicationId &&
        (() => {
          const selectedApp = rows.find((a) => a.id === selectedApplicationId)
          return selectedApp ? (
            <ApplicationDetail
              applicant={selectedApp}
              onClose={() => setSelectedApplicationId(null)}
            />
          ) : null
        })()}
    </PageContainer>
  )
}
