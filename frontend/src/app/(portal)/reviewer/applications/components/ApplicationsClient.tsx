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
import type { ApplicationStage, Role, WrittenAnswer } from '@/lib/api/types'
import { usePersistedFilters } from '@/hooks/usePersistedFilters'
import { useAnswersByApplicationIdBatches } from '@/lib/queries/answers'
import {
  useInfiniteApplications,
  useUpdateApplication,
} from '@/lib/queries/applications'
import { pickDefaultCycleId, useCycles } from '@/lib/queries/cycles'
import { useCurrentUser } from '@/lib/queries/users'
import { ROLE_COLUMNS } from '@/lib/roles'
import { ORDERED_STAGES, PAGE_SIZE } from './constants'
import { BulkActionBar } from './BulkActionBar'
import { availabilityOptionsFor, shortDays } from './meetingAvailability'
import type { ApplicantApplication } from './types'
import type { AnswerFilter, FilterChangeHandler } from './FilterButton'
import { TableView } from './TableView'
import { useApplicationFilters } from './useApplicationFilters'
import { KanbanView } from './KanbanView'
import { ApplicationDetail } from './ApplicationDetail'

type View = 'table' | 'kanban'

// How long typing settles before the search hits the server. Long enough that
// a typed word is one request, short enough to still feel live.
const SEARCH_DEBOUNCE_MS = 250

// Persisted across visits (not just in-session) so leaving the table to look
// at an applicant and coming back doesn't reset a filter set that took several
// chips to build. Versioned, like the chief-review queue's key: if a default
// below ever changes, bump this so the old one can't resurrect itself. v2
// dropped the standalone role, which is a filter chip now; v3 added the
// Returner chip.
const FILTERS_STORAGE_KEY = 'applications-filters-v3'

// The table opens on one role, which is what the server prefetch in ../page.tsx
// is keyed to. The Role chip is what widens it from there.
const DEFAULT_ROLES: Role[] = [ROLE_COLUMNS[0]]

type StoredFilters = {
  view: View
  cycleId: string
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
      stage: activeStage,
      search: debouncedSearch,
      filters,
    },
    restoreFilters,
    cycles.length > 0
  )

  // Which questions the chips can be built from, and the query params they
  // translate to — shared with the preference-list applicant pool.
  const {
    columns,
    questionsByCycleRole,
    availabilityQuestionIdByRole,
    hasAvailability,
    filterParams,
  } = useApplicationFilters({
    cycleId: activeCycle,
    defaultRoles: DEFAULT_ROLES,
    filters,
    setFilters,
  })

  // Every filter is applied in SQL, so the page the table renders is already
  // the answer — nothing below narrows it further. That is what makes the
  // totals and the stage counts trustworthy: they describe the same match,
  // counted server-side over every row rather than the page in hand.
  const listParams = useMemo(() => {
    if (!activeCycle) return undefined
    return {
      cycle_id: activeCycle,
      ...filterParams,
      ...(debouncedSearch && { search: debouncedSearch }),
      // Kanban lays every stage out side by side, so it can neither filter by
      // one stage nor take a page — it asks for the whole set instead.
      ...(view === 'table' && {
        ...(activeStage !== 'all' && { stage: activeStage }),
        limit: PAGE_SIZE,
      }),
    }
  }, [activeCycle, activeStage, debouncedSearch, filterParams, view])

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
        returner: app.returner,
      })),
    [applications]
  )

  const availabilityByApplicationId = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const app of applications) {
      map[app.id] = shortDays(
        availabilityOptionsFor(
          answersByApplicationId[app.id],
          availabilityQuestionIdByRole[app.role]
        )
      )
    }
    return map
  }, [applications, answersByApplicationId, availabilityQuestionIdByRole])

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
            hasAvailability={hasAvailability}
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
