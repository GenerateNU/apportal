'use client'
import { PageContainer } from '@/components/PageContainer'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, Loader2, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ProgressBar } from '@/components/ProgressBar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ApplicationStage, Role } from '@/lib/api/types'
import { useApplications } from '@/lib/queries/applications'
import { useChiefReviewsByApplicationIdBatch } from '@/lib/queries/chief-reviews'
import { pickDefaultCycleId, useCycles } from '@/lib/queries/cycles'
import { useReviewerProgress } from '@/lib/queries/reviewer-progress'
import { useChiefReviewers, useCurrentUser } from '@/lib/queries/users'
import { FILTER_STAGES } from '@/app/(portal)/reviewer/applications/components/constants'
import { ROLE_COLUMNS, ROLE_LABEL } from '@/lib/roles'

type VoteFilter = 'needsVote' | 'all'

// Same settle time as the applications table's and the lead queue's search.
const SEARCH_DEBOUNCE_MS = 250

// Persisted across visits (not just in-session) so leaving the queue to
// review an applicant and coming back doesn't reset the filters.
// v2: bumped so a stage: 'chief_review' saved under the old default doesn't
// resurrect it — that default hid almost everything (see activeStage below).
const FILTERS_STORAGE_KEY = 'chief-review-queue-filters-v2'

type StoredFilters = {
  cycleId?: string
  role?: Role | 'all'
  stage?: ApplicationStage | 'all'
  voteFilter?: VoteFilter
}

function readStoredFilters(): StoredFilters {
  try {
    return JSON.parse(localStorage.getItem(FILTERS_STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function writeStoredFilters(patch: StoredFilters) {
  localStorage.setItem(
    FILTERS_STORAGE_KEY,
    JSON.stringify({ ...readStoredFilters(), ...patch })
  )
}

export function ChiefReviewQueueClient() {
  const router = useRouter()
  const { data: currentUser } = useCurrentUser()
  const { data: cycles = [] } = useCycles({})
  const { data: chiefs = [], isLoading: chiefsLoading } = useChiefReviewers()

  // Default cycle, same as the other chief-only pipeline pages. Shared with
  // the server prefetch in ../page.tsx, which scopes its application-list
  // prefetch to this same cycle.
  const [cycleId, setCycleIdState] = useState('')
  const [activeRole, setActiveRoleState] = useState<Role | 'all'>('all')
  // Advancing an application to the chief_review stage is a manual, separate
  // action nobody reliably takes — defaulting this filter to that stage hid
  // every application chiefs actually needed to see (and already-cast votes
  // on applications still sitting in lead_review). Starts unfiltered; the
  // stage dropdown remains for narrowing manually.
  const [activeStage, setActiveStageState] = useState<ApplicationStage | 'all'>(
    'all'
  )
  // Defaults to the chief's own outstanding work, same as the lead queue
  // defaulting to "assigned to me" — the point of this queue is finding
  // applicants that still need a vote, not re-showing everyone every visit.
  const [voteFilter, setVoteFilterState] = useState<VoteFilter>('needsVote')

  // Matched server-side, so it narrows the whole queue rather than the rows
  // already in hand.
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedSearch(search),
      SEARCH_DEBOUNCE_MS
    )
    return () => clearTimeout(timer)
  }, [search])

  // Restored once on mount — done in an effect (rather than a useState
  // initializer) so the server-rendered markup and the first client render
  // match before localStorage is consulted.
  useEffect(() => {
    const stored = readStoredFilters()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored.cycleId) setCycleIdState(stored.cycleId)
    if (stored.role) setActiveRoleState(stored.role)
    if (stored.stage) setActiveStageState(stored.stage)
    if (stored.voteFilter) setVoteFilterState(stored.voteFilter)
  }, [])

  if (!cycleId && cycles.length > 0) {
    const defaultId = pickDefaultCycleId(cycles)
    if (defaultId) setCycleIdState(defaultId)
  }

  function setCycleId(id: string) {
    setCycleIdState(id)
    writeStoredFilters({ cycleId: id })
  }
  function setActiveRole(role: Role | 'all') {
    setActiveRoleState(role)
    writeStoredFilters({ role })
  }
  function setActiveStage(stage: ApplicationStage | 'all') {
    setActiveStageState(stage)
    writeStoredFilters({ stage })
  }
  function setVoteFilter(filter: VoteFilter) {
    setVoteFilterState(filter)
    writeStoredFilters({ voteFilter: filter })
  }

  const { data: applications = [], isLoading: applicationsLoading } =
    useApplications(
      cycleId
        ? {
            cycle_id: cycleId,
            ...(activeRole !== 'all' && { role: activeRole }),
            ...(activeStage !== 'all' && { stage: activeStage }),
            ...(debouncedSearch && { search: debouncedSearch }),
          }
        : undefined
    )

  const applicationIds = useMemo(
    () => applications.map((a) => a.id),
    [applications]
  )

  // All chief reviews for the queue in one request rather than one per
  // application, used both for "have I reviewed this" and the vote count.
  const { data: chiefReviewsByApplicationId = {}, isLoading: reviewsLoading } =
    useChiefReviewsByApplicationIdBatch(applicationIds)

  // A review is a cast vote — a comment is optional and doesn't by itself
  // count as having reviewed.
  const submittedByApplicationId = useMemo(() => {
    const map: Record<string, boolean> = {}
    for (const id of applicationIds) {
      const own = chiefReviewsByApplicationId[id]?.find(
        (r) => r.reviewer_nuid === currentUser?.nuid
      )
      map[id] = !!own?.vote
    }
    return map
  }, [applicationIds, chiefReviewsByApplicationId, currentUser?.nuid])

  const chiefVoteCountByApplicationId = useMemo(() => {
    const map: Record<string, number> = {}
    for (const id of applicationIds) {
      map[id] = (chiefReviewsByApplicationId[id] ?? []).filter(
        (r) => !!r.vote
      ).length
    }
    return map
  }, [applicationIds, chiefReviewsByApplicationId])

  // Own-vote progress across the current cycle/role/stage/search filters —
  // independent of voteFilter below, which only changes what's *displayed*,
  // not this denominator.
  const votedCount = applicationIds.filter(
    (id) => submittedByApplicationId[id]
  ).length
  // Voting through dozens of applicants is sequential work, so the primary
  // action is "pick up where I left off" — same pattern as the lead queue's
  // "Continue reviewing".
  const nextUnvoted = applications.find((a) => !submittedByApplicationId[a.id])

  const visibleApplications = useMemo(
    () =>
      voteFilter === 'needsVote'
        ? applications.filter((a) => !submittedByApplicationId[a.id])
        : applications,
    [applications, voteFilter, submittedByApplicationId]
  )

  // How many of the leads assigned to each application have submitted their
  // written review, so the queue can show "x/x reviews completed". Fetched
  // per role — a fixed, small list, so this is always ROLE_COLUMNS.length
  // requests rather than one per application. ROLE_COLUMNS is a module-level
  // constant, so this calls the hook the same number of times every render.
  const reviewerProgressQueries = ROLE_COLUMNS.map((role) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useReviewerProgress(cycleId, role)
  )
  const activeReviewerProgressQueries = reviewerProgressQueries.filter(
    (_, i) => activeRole === 'all' || ROLE_COLUMNS[i] === activeRole
  )
  const leadReviewProgressByApplicationId: Record<
    string,
    { completed: number; total: number }
  > = {}
  for (const query of activeReviewerProgressQueries) {
    for (const lead of query.data ?? []) {
      for (const item of lead.items) {
        const entry = leadReviewProgressByApplicationId[
          item.application_id
        ] ?? { completed: 0, total: 0 }
        entry.total += 1
        if (item.submitted_at) entry.completed += 1
        leadReviewProgressByApplicationId[item.application_id] = entry
      }
    }
  }

  const isLoading =
    applicationsLoading ||
    reviewsLoading ||
    chiefsLoading ||
    activeReviewerProgressQueries.some((q) => q.isLoading)

  return (
    <PageContainer>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-text-default text-2xl font-semibold">
            Chief review
          </h1>
          <p className="text-text-muted mt-1 text-sm">
            Review each applicant&apos;s lead scores and decide who advances to
            an interview.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={activeStage}
            onValueChange={(val) =>
              setActiveStage(val as ApplicationStage | 'all')
            }
          >
            <SelectTrigger className="w-56" aria-label="Filter by stage">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILTER_STAGES.map(({ label, value }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={activeRole}
            onValueChange={(val) => setActiveRole(val as Role | 'all')}
          >
            <SelectTrigger className="w-56" aria-label="Filter by role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {ROLE_COLUMNS.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={cycleId} onValueChange={setCycleId}>
            <SelectTrigger className="w-40" aria-label="Filter by cycle">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {cycles.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
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
          <div className="flex shrink-0 gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
            {(
              [
                { value: 'needsVote', label: 'Needs my vote' },
                { value: 'all', label: 'All' },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setVoteFilter(option.value)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-sm font-medium transition-colors',
                  voteFilter === option.value
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {applications.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ProgressBar
              value={votedCount}
              total={applications.length}
              className="w-40"
            />
            <span className="text-text-muted text-xs">
              {votedCount} of {applications.length} voted
            </span>
          </div>
          {nextUnvoted && (
            <Button asChild>
              <Link href={`/reviewer/chief-review/${nextUnvoted.id}`}>
                {votedCount === 0 ? 'Start voting' : 'Continue voting'}
                <ArrowRight data-icon="inline-end" size={14} />
              </Link>
            </Button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="text-text-muted flex items-center gap-2 px-2 py-10 text-sm">
          <Loader2 className="animate-spin" size={16} />
          Loading…
        </div>
      ) : applications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
          <p className="text-text-default text-sm font-medium">
            {debouncedSearch
              ? 'No applications match that search.'
              : 'Nothing to review yet'}
          </p>
          <p className="text-text-muted mt-1 text-sm">
            {debouncedSearch
              ? 'Try a different name or NUID.'
              : 'Submitted applications will show up here.'}
          </p>
        </div>
      ) : visibleApplications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
          <p className="text-text-default text-sm font-medium">
            You&apos;re all caught up
          </p>
          <p className="text-text-muted mt-1 text-sm">
            Every applicant in this filter already has your vote — switch to
            &quot;All&quot; to see them.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {ROLE_COLUMNS.map((role) => {
            const roleApps = visibleApplications.filter((a) => a.role === role)
            if (roleApps.length === 0) return null
            return (
              <section key={role}>
                <h2 className="text-text-default mb-3 text-sm font-semibold">
                  {ROLE_LABEL[role]}{' '}
                  <span className="text-text-faint font-normal">
                    ({roleApps.length})
                  </span>
                </h2>
                <div className="flex flex-col gap-3">
                  {roleApps.map((application) => {
                    const submitted = submittedByApplicationId[application.id]
                    const leadProgress =
                      leadReviewProgressByApplicationId[application.id]
                    const chiefVoteCount =
                      chiefVoteCountByApplicationId[application.id] ?? 0
                    return (
                      <div
                        key={application.id}
                        className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 bg-white p-4 transition-colors hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-text-default text-sm font-medium">
                            {application.full_name || application.user_nuid}
                          </span>
                          {leadProgress && leadProgress.total > 0 && (
                            <span
                              className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                                leadProgress.completed === leadProgress.total
                                  ? 'bg-status-open/15 text-status-open'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {leadProgress.completed}/{leadProgress.total}{' '}
                              reviews completed
                            </span>
                          )}
                          {submitted && (
                            <span className="bg-status-open/15 text-status-open inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium">
                              <Check size={12} />
                              Submitted
                            </span>
                          )}
                          <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                            {chiefVoteCount}/{chiefs.length} chiefs reviewed
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() =>
                            router.push(
                              `/reviewer/chief-review/${application.id}`
                            )
                          }
                        >
                          {submitted ? 'View' : 'Review'}
                          <ArrowRight data-icon="inline-end" size={14} />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </PageContainer>
  )
}
