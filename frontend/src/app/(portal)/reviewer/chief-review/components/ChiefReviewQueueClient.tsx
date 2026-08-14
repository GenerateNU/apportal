'use client'
import { PageContainer } from '@/components/PageContainer'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Ban,
  Check,
  Eye,
  EyeOff,
  Loader2,
  MoreVertical,
  Search,
  UserCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProgressBar } from '@/components/ProgressBar'
import { Tooltip } from '@/components/Tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ApplicationStage, ChiefVote, Role } from '@/lib/api/types'
import {
  useApplications,
  useUpdateApplication,
} from '@/lib/queries/applications'
import { useChiefReviewsByApplicationIdBatch } from '@/lib/queries/chief-reviews'
import { chiefReviewQueueSearchParams } from '@/lib/queries/chief-review-queue'
import {
  CHIEF_VOTE_BADGE_CLASS,
  CHIEF_VOTE_DOT_CLASS,
  CHIEF_VOTE_LABEL,
  CHIEF_VOTE_ORDER,
} from '@/lib/chief-votes'
import { pickDefaultCycleId, useCycles } from '@/lib/queries/cycles'
import { useReviewerProgress } from '@/lib/queries/reviewer-progress'
import { useChiefReviewers, useCurrentUser } from '@/lib/queries/users'
import { FILTER_STAGES } from '@/app/(portal)/reviewer/applications/components/constants'
import { ROLE_COLUMNS, ROLE_LABEL } from '@/lib/roles'

// Whether to show every applicant or just the ones still needing my vote.
type VoteScope = 'needsVote' | 'all'
// Independent of VoteScope — narrows to applicants I gave this specific vote.
type VoteValueFilter = 'all' | ChiefVote

// Same settle time as the applications table's and the lead queue's search.
const SEARCH_DEBOUNCE_MS = 250

// Persisted across visits (not just in-session) so leaving the queue to
// review an applicant and coming back doesn't reset the filters.
// v2: bumped so a stage: 'chief_review' saved under the old default doesn't
// resurrect it — that default hid almost everything (see activeStage below).
// v3: bumped so a voteScope: 'needsVote' saved under the old default doesn't
// resurrect it now that the default is 'all'.
const FILTERS_STORAGE_KEY = 'chief-review-queue-filters-v3'

type StoredFilters = {
  cycleId?: string
  role?: Role | 'all'
  stage?: ApplicationStage | 'all'
  voteScope?: VoteScope
  voteValue?: VoteValueFilter
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
  // One shared mutation, so this tracks which row is in flight — otherwise
  // every row's button would show a spinner whenever any one of them does.
  const updateStage = useUpdateApplication()
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  function updateApplicationStage(
    applicationId: string,
    stage: ApplicationStage
  ) {
    setUpdatingId(applicationId)
    updateStage.mutate(
      { id: applicationId, body: { stage } },
      { onSettled: () => setUpdatingId(null) }
    )
  }

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
  // Starts unfiltered — the "needs my vote" scope stays available via the
  // select below, but defaulting to it hid every already-voted applicant a
  // chief still wanted to see (e.g. to revisit or compare votes).
  const [voteScope, setVoteScopeState] = useState<VoteScope>('all')
  // Independent of voteScope — narrows to a specific vote value regardless
  // of the scope toggle above.
  const [voteValue, setVoteValueState] = useState<VoteValueFilter>('all')
  // Not persisted (unlike the filters above) and defaults off, same as the
  // detail page's "reveal other chiefs' votes" toggle — seeing every vote at
  // a glance while scanning the queue is exactly the anchoring risk that
  // toggle exists to avoid, so it stays an opt-in per visit.
  const [showVotes, setShowVotes] = useState(false)

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
    if (stored.voteScope) setVoteScopeState(stored.voteScope)
    if (stored.voteValue) setVoteValueState(stored.voteValue)
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
  function setVoteScope(scope: VoteScope) {
    setVoteScopeState(scope)
    writeStoredFilters({ voteScope: scope })
  }
  function setVoteValue(value: VoteValueFilter) {
    setVoteValueState(value)
    writeStoredFilters({ voteValue: value })
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

  // The chief's own vote per application (undefined if not yet cast). A
  // review is a cast vote — a comment is optional and doesn't by itself
  // count as having reviewed.
  const ownVoteByApplicationId = useMemo(() => {
    const map: Record<string, ChiefVote | undefined> = {}
    for (const id of applicationIds) {
      const own = chiefReviewsByApplicationId[id]?.find(
        (r) => r.reviewer_nuid === currentUser?.nuid
      )
      map[id] = own?.vote ?? undefined
    }
    return map
  }, [applicationIds, chiefReviewsByApplicationId, currentUser?.nuid])
  const submittedByApplicationId = useMemo(() => {
    const map: Record<string, boolean> = {}
    for (const id of applicationIds) map[id] = !!ownVoteByApplicationId[id]
    return map
  }, [applicationIds, ownVoteByApplicationId])

  const chiefVoteCountByApplicationId = useMemo(() => {
    const map: Record<string, number> = {}
    for (const id of applicationIds) {
      map[id] = (chiefReviewsByApplicationId[id] ?? []).filter(
        (r) => !!r.vote
      ).length
    }
    return map
  }, [applicationIds, chiefReviewsByApplicationId])

  // Every cast vote for each application, weakest-no to strongest-yes — the
  // dot indicator behind the reveal toggle below.
  const votesByApplicationId = useMemo(() => {
    const map: Record<string, ChiefVote[]> = {}
    for (const id of applicationIds) {
      map[id] = (chiefReviewsByApplicationId[id] ?? [])
        .map((r) => r.vote)
        .filter((v): v is ChiefVote => !!v)
        .sort(
          (a, b) => CHIEF_VOTE_ORDER.indexOf(a) - CHIEF_VOTE_ORDER.indexOf(b)
        )
    }
    return map
  }, [applicationIds, chiefReviewsByApplicationId])

  // Flags an application where every vote cast SO FAR agrees on one of the
  // two strong ends — re-evaluated as more chiefs vote, not gated on every
  // chief having voted, so early unanimous agreement (or an early outlier)
  // surfaces as soon as it exists.
  const unanimousStrongByApplicationId = useMemo(() => {
    const map: Record<string, ChiefVote | null> = {}
    for (const id of applicationIds) {
      const votes = votesByApplicationId[id] ?? []
      if (votes.length === 0) {
        map[id] = null
      } else if (votes.every((v) => v === 'strong_interview')) {
        map[id] = 'strong_interview'
      } else if (votes.every((v) => v === 'strong_no_interview')) {
        map[id] = 'strong_no_interview'
      } else {
        map[id] = null
      }
    }
    return map
  }, [applicationIds, votesByApplicationId])

  // Own-vote progress across the current cycle/role/stage/search filters —
  // independent of voteScope/voteValue below, which only change what's
  // *displayed*, not this denominator.
  const votedCount = applicationIds.filter(
    (id) => submittedByApplicationId[id]
  ).length
  // Same scope as votedCount above — how many applicants I put in each
  // category, not affected by the voteScope/voteValue display filters.
  const ownVoteCountByValue = useMemo(() => {
    const counts: Record<ChiefVote, number> = {
      strong_interview: 0,
      interview: 0,
      neutral: 0,
      no_interview: 0,
      strong_no_interview: 0,
    }
    for (const id of applicationIds) {
      const vote = ownVoteByApplicationId[id]
      if (vote) counts[vote] += 1
    }
    return counts
  }, [applicationIds, ownVoteByApplicationId])
  // Voting through dozens of applicants is sequential work, so the primary
  // action is "pick up where I left off" — same pattern as the lead queue's
  // "Continue reviewing".
  const nextUnvoted = applications.find((a) => !submittedByApplicationId[a.id])

  // voteScope and voteValue are independent filters, applied together (AND):
  // scope narrows to voted/unvoted, value narrows to a specific vote.
  const visibleApplications = useMemo(() => {
    return applications.filter((a) => {
      if (voteScope === 'needsVote' && submittedByApplicationId[a.id]) {
        return false
      }
      if (voteValue !== 'all' && ownVoteByApplicationId[a.id] !== voteValue) {
        return false
      }
      return true
    })
  }, [
    applications,
    voteScope,
    voteValue,
    submittedByApplicationId,
    ownVoteByApplicationId,
  ])

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

  // Carried onto every link into an applicant's detail page, so its
  // Next/Previous buttons retrace this same filtered list instead of the
  // whole cycle.
  const queueSearchParams = chiefReviewQueueSearchParams({
    role: activeRole,
    stage: activeStage,
    search: debouncedSearch,
    voteScope,
    voteValue,
  })
  const queueSuffix = queueSearchParams ? `?${queueSearchParams}` : ''

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
          <Select
            value={voteScope}
            onValueChange={(val) => setVoteScope(val as VoteScope)}
          >
            <SelectTrigger className="w-40" aria-label="Filter by vote status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="needsVote">Needs my vote</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={voteValue}
            onValueChange={(val) => setVoteValue(val as VoteValueFilter)}
          >
            <SelectTrigger className="w-52" aria-label="Filter by vote value">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any vote</SelectItem>
              {CHIEF_VOTE_ORDER.map((vote) => (
                <SelectItem key={vote} value={vote}>
                  My vote: {CHIEF_VOTE_LABEL[vote]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!isLoading && applications.length > 0 && (
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowVotes((prev) => !prev)}
              className="text-text-muted hover:text-text-default inline-flex items-center gap-1.5 text-xs font-medium"
            >
              {showVotes ? (
                <>
                  <EyeOff size={14} />
                  Hide votes
                </>
              ) : (
                <>
                  <Eye size={14} />
                  Reveal votes
                </>
              )}
            </button>
            {nextUnvoted && (
              <Button asChild>
                <Link
                  href={`/reviewer/chief-review/${nextUnvoted.id}${queueSuffix}`}
                >
                  {votedCount === 0 ? 'Start voting' : 'Continue voting'}
                  <ArrowRight data-icon="inline-end" size={14} />
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}

      {!isLoading && applications.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {CHIEF_VOTE_ORDER.map((vote) => (
            <span
              key={vote}
              className={`rounded-md px-2 py-0.5 text-xs font-medium ${CHIEF_VOTE_BADGE_CLASS[vote]}`}
            >
              {ownVoteCountByValue[vote]} {CHIEF_VOTE_LABEL[vote]}
            </span>
          ))}
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
            {voteValue !== 'all'
              ? 'No applicants match this vote'
              : "You're all caught up"}
          </p>
          <p className="text-text-muted mt-1 text-sm">
            {voteValue !== 'all'
              ? 'Try "Any vote" to clear the vote-value filter.'
              : 'Every applicant in this filter already has your vote — switch to "All" to see them.'}
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
                    const ownVote = ownVoteByApplicationId[application.id]
                    const leadProgress =
                      leadReviewProgressByApplicationId[application.id]
                    const chiefVoteCount =
                      chiefVoteCountByApplicationId[application.id] ?? 0
                    const votes = votesByApplicationId[application.id] ?? []
                    const unanimousStrong =
                      unanimousStrongByApplicationId[application.id]
                    const highlightUnanimous = showVotes && unanimousStrong
                    return (
                      <div
                        key={application.id}
                        className={`flex items-center justify-between gap-4 rounded-xl border p-4 transition-colors hover:bg-gray-50 ${
                          highlightUnanimous === 'strong_interview'
                            ? 'border-status-open bg-status-open/5'
                            : highlightUnanimous === 'strong_no_interview'
                              ? 'border-red-300 bg-red-50'
                              : 'border-gray-100 bg-white'
                        }`}
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
                          <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                            {chiefVoteCount}/{chiefs.length} chiefs reviewed
                          </span>
                          {showVotes && votes.length > 0 && (
                            <span
                              className="flex items-center gap-1"
                              aria-label={votes
                                .map((v) => CHIEF_VOTE_LABEL[v])
                                .join(', ')}
                              title={votes
                                .map((v) => CHIEF_VOTE_LABEL[v])
                                .join(', ')}
                            >
                              {votes.map((v, i) => (
                                <span
                                  key={i}
                                  className={`h-2 w-2 rounded-full ${CHIEF_VOTE_DOT_CLASS[v]}`}
                                />
                              ))}
                            </span>
                          )}
                          {highlightUnanimous && (
                            <span
                              className={`rounded-md px-2 py-0.5 text-xs font-medium ${CHIEF_VOTE_BADGE_CLASS[highlightUnanimous]}`}
                            >
                              Unanimous {CHIEF_VOTE_LABEL[highlightUnanimous]}
                            </span>
                          )}
                          <DropdownMenu>
                            <Tooltip label="More actions">
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label="More actions"
                                >
                                  {updatingId === application.id ? (
                                    <Loader2
                                      className="animate-spin"
                                      size={14}
                                    />
                                  ) : (
                                    <MoreVertical size={14} />
                                  )}
                                </Button>
                              </DropdownMenuTrigger>
                            </Tooltip>
                            <DropdownMenuContent align="start">
                              <DropdownMenuItem
                                disabled={
                                  application.stage === 'interview' ||
                                  updatingId === application.id
                                }
                                onClick={() =>
                                  updateApplicationStage(
                                    application.id,
                                    'interview'
                                  )
                                }
                              >
                                <UserCheck size={14} />
                                {application.stage === 'interview'
                                  ? 'Already in interview stage'
                                  : 'Advance to interview'}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                disabled={
                                  application.stage === 'rejected' ||
                                  updatingId === application.id
                                }
                                onClick={() =>
                                  updateApplicationStage(
                                    application.id,
                                    'rejected'
                                  )
                                }
                              >
                                <Ban size={14} />
                                {application.stage === 'rejected'
                                  ? 'Already rejected'
                                  : 'Reject'}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="flex items-center gap-2">
                          {submitted && ownVote && (
                            <span
                              className={`rounded-md px-2 py-0.5 text-xs font-medium ${CHIEF_VOTE_BADGE_CLASS[ownVote]}`}
                            >
                              {CHIEF_VOTE_LABEL[ownVote]}
                            </span>
                          )}
                          {submitted && (
                            <span className="bg-brand-blue/10 text-brand-blue inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium">
                              <Check size={12} />
                              Submitted
                            </span>
                          )}
                          <Button
                            variant="outline"
                            onClick={() =>
                              router.push(
                                `/reviewer/chief-review/${application.id}${queueSuffix}`
                              )
                            }
                          >
                            {submitted ? 'View' : 'Review'}
                            <ArrowRight data-icon="inline-end" size={14} />
                          </Button>
                        </div>
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
