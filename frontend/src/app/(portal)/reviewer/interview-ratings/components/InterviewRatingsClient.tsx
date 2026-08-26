'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  Lock,
  Unlock,
  Users,
  LayoutList,
} from 'lucide-react'
import { PageContainer } from '@/components/PageContainer'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {
  ApplicationStage,
  ApplicationSummary,
  Interview,
  InterviewRating,
  Role,
} from '@/lib/api/types'
import { useApplications } from '@/lib/queries/applications'
import { pickDefaultCycleId, useCycles } from '@/lib/queries/cycles'
import {
  useInterviewAssignmentsBulk,
  useRecordingReviewerAssignmentsBulk,
} from '@/lib/queries/interview-assignments'
import { useInterviewsByApplicationIdBatches } from '@/lib/queries/interviews'
import { useRecordingReviewsByInterviewIds } from '@/lib/queries/recording-reviews'
import {
  useReviewGates,
  useSetReviewRelease,
} from '@/lib/queries/review-releases'
import { useChiefs, useCurrentUser, useLeads } from '@/lib/queries/users'
import { RATING_COLORS, RATING_LABEL } from '@/lib/interview-ratings'
import { ROLE_CHIP_CLASS, ROLE_COLUMNS, ROLE_LABEL } from '@/lib/roles'
import {
  stageBadge,
  stageLabel,
} from '@/app/(portal)/reviewer/applications/components/constants'
import type { ReviewState } from '../../my-reviews/constants'
import {
  REVIEW_STATE_BADGE,
  REVIEW_STATE_DOT,
} from '../../my-reviews/constants'
import { INTERVIEW_STATE_LABEL } from '../../my-interviews/constants'

// Applicants who are actually in the interview pipeline — everyone else
// (still in lead/chief review, say) doesn't belong on this page yet.
const INTERVIEW_STAGES: ApplicationStage[] = [
  'interview',
  'interview_scheduled',
  'interview_conducted',
  'interview_review',
]

type Row = {
  application: ApplicationSummary
  interview: Interview | null | undefined
  interviewerNuid: string | null
  reviewerCount: number
  reviewedCount: number
}

type RatingKey = InterviewRating | 'none'

// Worst to best, with the not-yet-rated bucket leading — matches how a
// chief scans the queue (unrated first, then increasingly promising).
const RATING_DISPLAY_ORDER: InterviewRating[] = [
  'do_not_hire',
  'neutral',
  'good',
  'great',
  'must_hire',
]

const RATING_COLUMN_DEFS: { key: RatingKey; title: string }[] = [
  { key: 'none', title: 'Interview' },
  ...RATING_DISPLAY_ORDER.map((value) => ({
    key: value as RatingKey,
    title: RATING_LABEL[value],
  })),
]

// Static classes (not built from a runtime template) so Tailwind's JIT scan
// picks them up — one entry per possible visible-column count, up to
// RATING_COLUMN_DEFS.length.
const SWIMLANE_GRID_COLS_CLASS: Record<number, string> = {
  1: 'grid-cols-[repeat(1,20rem)]',
  2: 'grid-cols-[repeat(2,20rem)]',
  3: 'grid-cols-[repeat(3,20rem)]',
  4: 'grid-cols-[repeat(4,20rem)]',
  5: 'grid-cols-[repeat(5,20rem)]',
  6: 'grid-cols-[repeat(6,20rem)]',
}

function emptyRatingBuckets(): Record<RatingKey, Row[]> {
  return {
    must_hire: [],
    great: [],
    good: [],
    neutral: [],
    do_not_hire: [],
    none: [],
  }
}

export function InterviewRatingsClient() {
  const { data: cycles = [] } = useCycles({})
  const { data: leads = [] } = useLeads()
  const { data: chiefs = [] } = useChiefs()
  const { data: currentUser } = useCurrentUser()

  const pathname = usePathname()
  const initialParams = useSearchParams()

  const [cycleId, setCycleId] = useState(() => initialParams.get('cycle') ?? '')
  if (!cycleId && cycles.length > 0) {
    const defaultId = pickDefaultCycleId(cycles)
    if (defaultId) setCycleId(defaultId)
  }
  const [activeRole, setActiveRole] = useState<Role | 'all'>(
    () => (initialParams.get('role') as Role | 'all') || 'all'
  )
  const [groupByInterviewer, setGroupByInterviewer] = useState(
    () => initialParams.get('view') !== 'rating'
  )
  const [interviewerFilter, setInterviewerFilter] = useState(
    () => initialParams.get('interviewer') ?? 'all'
  )
  const [collapsedLanes, setCollapsedLanes] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState(
    () => initialParams.get('q') ?? ''
  )

  // Mirrored into the URL (via history, not the router, so a filter change
  // doesn't cost a server round trip) purely so following a card into an
  // interview and coming back restores this exact view instead of resetting.
  const filterQuery = useMemo(() => {
    const params = new URLSearchParams()
    if (cycleId) params.set('cycle', cycleId)
    if (activeRole !== 'all') params.set('role', activeRole)
    if (!groupByInterviewer) params.set('view', 'rating')
    if (interviewerFilter !== 'all')
      params.set('interviewer', interviewerFilter)
    if (searchQuery) params.set('q', searchQuery)
    return params.toString()
  }, [cycleId, activeRole, groupByInterviewer, interviewerFilter, searchQuery])

  useEffect(() => {
    const url = filterQuery ? `${pathname}?${filterQuery}` : pathname
    window.history.replaceState(null, '', url)
  }, [filterQuery, pathname])

  // The `released` value being confirmed; null while the dialog is closed.
  const [confirmingRelease, setConfirmingRelease] = useState<boolean | null>(
    null
  )

  const { data: applications = [] } = useApplications(
    {
      ...(cycleId && { cycle_id: cycleId }),
      ...(activeRole !== 'all' && { role: activeRole }),
    },
    undefined,
    { enabled: !!cycleId }
  )

  const isChief = !!currentUser?.roles.some(
    (r) => r === 'chief' || r === 'admin'
  )
  const showSwimlanes = groupByInterviewer && isChief

  // The blind-review gate is per cycle x applicant role, so the button acts on
  // whichever roles the page is currently showing — both, under "All roles".
  const releaseRoles = activeRole === 'all' ? ROLE_COLUMNS : [activeRole]
  const { data: reviewGates = [] } = useReviewGates(isChief ? cycleId : '')
  const setRelease = useSetReviewRelease()
  const recordingGates = reviewGates.filter(
    (g) =>
      g.kind === 'recording' && (activeRole === 'all' || g.role === activeRole)
  )
  const allReleased =
    recordingGates.length > 0 && recordingGates.every((g) => g.released)
  const submittedReviews = recordingGates.reduce(
    (n, g) => n + g.submitted_count,
    0
  )
  const assignedReviews = recordingGates.reduce(
    (n, g) => n + g.assigned_count,
    0
  )
  const scopeLabel =
    activeRole === 'all'
      ? 'all applicants'
      : `${ROLE_LABEL[activeRole].toLowerCase()} applicants`

  function confirmRelease() {
    if (confirmingRelease === null) return
    const released = confirmingRelease
    // One call per role — the endpoint gates a single role at a time.
    Promise.all(
      releaseRoles.map((role) =>
        setRelease.mutateAsync({
          cycleId,
          body: { role, kind: 'recording', released },
        })
      )
    )
      .then(() => setConfirmingRelease(null))
      // Left open on failure; the dialog shows the error.
      .catch(() => {})
  }

  // Nuid -> display name, for the interviewer shown per row/lane — same
  // lookup MyInterviewsClient uses for its chief "viewing" dropdown.
  const nameByNuid = useMemo(() => {
    const byNuid = new Map<string, string>()
    for (const u of [...leads, ...chiefs]) byNuid.set(u.nuid, u.full_name)
    return byNuid
  }, [leads, chiefs])

  const applicationIds = useMemo(
    () => applications.map((a) => a.id),
    [applications]
  )

  // Everything below is fetched once for the whole roster, not once per row.
  const [interviewBatch] = useInterviewsByApplicationIdBatches(
    applicationIds.length > 0 ? [applicationIds] : []
  )
  const interviewByApplicationId = interviewBatch?.data

  const { data: assignmentByApplicationId } = useInterviewAssignmentsBulk(
    isChief ? applicationIds : []
  )
  const { data: reviewerAssignmentsByApplicationId } =
    useRecordingReviewerAssignmentsBulk(isChief ? applicationIds : [])

  const interviewIds = useMemo(
    () =>
      applications
        .map((a) => interviewByApplicationId?.[a.id]?.id)
        .filter((id): id is string => !!id),
    [applications, interviewByApplicationId]
  )
  const { data: recordingReviewsByInterviewId } =
    useRecordingReviewsByInterviewIds(interviewIds)

  const rows: Row[] = useMemo(
    () =>
      applications
        .map((application) => {
          const interview = interviewByApplicationId?.[application.id]
          const reviewerAssignments =
            reviewerAssignmentsByApplicationId?.[application.id] ?? []
          const reviews = interview?.id
            ? (recordingReviewsByInterviewId?.[interview.id] ?? [])
            : []
          const reviewedNuids = new Set(
            reviews.filter((r) => r.submitted_at).map((r) => r.reviewer_nuid)
          )
          return {
            application,
            interview,
            interviewerNuid:
              assignmentByApplicationId?.[application.id]?.interviewer_nuid ??
              null,
            reviewerCount: reviewerAssignments.length,
            reviewedCount: reviewerAssignments.filter((a) =>
              reviewedNuids.has(a.lead_nuid)
            ).length,
          }
        })
        .filter(
          ({ application, interview }) =>
            !!interview ||
            INTERVIEW_STAGES.includes(application.stage as ApplicationStage)
        ),
    [
      applications,
      interviewByApplicationId,
      assignmentByApplicationId,
      reviewerAssignmentsByApplicationId,
      recordingReviewsByInterviewId,
    ]
  )

  const byName = (a: Row, b: Row) =>
    (a.application.full_name || a.application.user_nuid).localeCompare(
      b.application.full_name || b.application.user_nuid
    )

  // Every interviewer with at least one assigned applicant in the current
  // cycle/role filter — options for the interviewer filter below.
  const availableInterviewers = useMemo(() => {
    const nuids = new Set<string>()
    for (const row of rows) {
      if (row.interviewerNuid) nuids.add(row.interviewerNuid)
    }
    return [...nuids]
      .map((nuid) => ({ nuid, name: nameByNuid.get(nuid) ?? nuid }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [rows, nameByNuid])

  const filteredRows = useMemo(() => {
    let filtered = rows

    // Filter by interviewer
    if (interviewerFilter !== 'all') {
      if (interviewerFilter === 'unassigned') {
        filtered = filtered.filter((r) => !r.interviewerNuid)
      } else {
        filtered = filtered.filter(
          (r) => r.interviewerNuid === interviewerFilter
        )
      }
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(
        (r) =>
          r.application.full_name?.toLowerCase().includes(query) ||
          r.application.user_nuid.toLowerCase().includes(query) ||
          r.application.email?.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [rows, interviewerFilter, searchQuery])

  // Total per rating across the current filter — drives both the flat kanban
  // and the swimlane header, and which (usually empty) columns to hide.
  const ratingTotals = useMemo(() => {
    const totals = emptyRatingBuckets() as unknown as Record<RatingKey, number>
    for (const key of Object.keys(totals) as RatingKey[]) totals[key] = 0
    for (const row of filteredRows) {
      totals[row.interview?.rating ?? 'none']++
    }
    return totals
  }, [filteredRows])

  const visibleColumnDefs = useMemo(
    () => RATING_COLUMN_DEFS.filter((c) => ratingTotals[c.key] > 0),
    [ratingTotals]
  )

  const ratingColumns = useMemo(() => {
    const byRating = emptyRatingBuckets()
    for (const row of filteredRows) {
      byRating[row.interview?.rating ?? 'none'].push(row)
    }
    for (const key of Object.keys(byRating) as RatingKey[]) {
      byRating[key].sort(byName)
    }
    return visibleColumnDefs.map((c) => ({
      key: c.key,
      title: c.title,
      rows: byRating[c.key],
    }))
  }, [filteredRows, visibleColumnDefs])

  // One lane per interviewer, each holding its own rating -> rows map, for
  // the swimlane board (rating columns repeated per interviewer).
  const swimlanes = useMemo(() => {
    const byInterviewer = new Map<string, Row[]>()
    for (const row of filteredRows) {
      const key = row.interviewerNuid ?? 'unassigned'
      const list = byInterviewer.get(key) ?? []
      list.push(row)
      byInterviewer.set(key, list)
    }
    const lanes = [...byInterviewer.entries()].map(([nuid, laneRows]) => {
      const byRating = emptyRatingBuckets()
      for (const row of laneRows) {
        byRating[row.interview?.rating ?? 'none'].push(row)
      }
      for (const key of Object.keys(byRating) as RatingKey[]) {
        byRating[key].sort(byName)
      }
      return {
        key: nuid,
        title:
          nuid === 'unassigned' ? 'Unassigned' : (nameByNuid.get(nuid) ?? nuid),
        count: laneRows.length,
        byRating,
      }
    })
    lanes.sort((a, b) => {
      if (a.key === 'unassigned') return 1
      if (b.key === 'unassigned') return -1
      return a.title.localeCompare(b.title)
    })
    return lanes
  }, [filteredRows, nameByNuid])

  function toggleLane(key: string) {
    setCollapsedLanes((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-text-default text-2xl font-semibold">
            Interview ratings
          </h1>
          <p className="text-text-muted mt-1 text-sm">
            Every interviewed applicant, grouped by their interviewer&apos;s
            rating. Applicants whose interview isn&apos;t complete yet sit in
            their own bucket.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isChief && recordingGates.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-text-muted text-xs">
                {submittedReviews}/{assignedReviews} reviews in
              </span>
              <Button
                size="sm"
                variant={allReleased ? 'outline' : 'default'}
                onClick={() => setConfirmingRelease(!allReleased)}
                disabled={setRelease.isPending}
              >
                {allReleased ? <Lock size={14} /> : <Unlock size={14} />}
                {allReleased ? 'Hide reviews' : 'Release reviews'}
              </Button>
            </div>
          )}

          <div className="relative w-64">
            <Input
              type="text"
              placeholder="Search by name, NUID, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pr-8 pl-3 text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>

          {isChief && (
            <div className="flex rounded-md border border-gray-200 bg-white">
              <button
                onClick={() => setGroupByInterviewer(false)}
                className={`flex items-center gap-1.5 rounded-l-md px-3 py-1.5 text-sm transition-colors ${
                  !groupByInterviewer
                    ? 'text-text-default bg-gray-100 font-medium'
                    : 'text-text-subtle hover:text-text-secondary'
                }`}
                aria-label="List view"
              >
                <LayoutList className="h-4 w-4" />
                By rating
              </button>
              <button
                onClick={() => setGroupByInterviewer(true)}
                className={`flex items-center gap-1.5 rounded-r-md px-3 py-1.5 text-sm transition-colors ${
                  groupByInterviewer
                    ? 'text-text-default bg-gray-100 font-medium'
                    : 'text-text-subtle hover:text-text-secondary'
                }`}
                aria-label="Grouped by interviewer view"
              >
                <Users className="h-4 w-4" />
                By interviewer
              </button>
            </div>
          )}

          {isChief && (
            <Select
              value={interviewerFilter}
              onValueChange={setInterviewerFilter}
            >
              <SelectTrigger
                className="w-48"
                aria-label="Filter by interviewer"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All interviewers</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {availableInterviewers.map((i) => (
                  <SelectItem key={i.nuid} value={i.nuid}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select
            value={activeRole}
            onValueChange={(val) => setActiveRole(val as Role | 'all')}
          >
            <SelectTrigger className="w-48" aria-label="Filter by role">
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
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-text-faint px-1 text-sm">
          No applicants have reached interviews yet for this cycle/role.
        </p>
      ) : filteredRows.length === 0 ? (
        <p className="text-text-faint px-1 text-sm">
          No applicants match this interviewer filter.
        </p>
      ) : showSwimlanes ? (
        <div className="max-h-[70vh] overflow-auto rounded-lg border border-gray-200 pb-4">
          <div
            className={`sticky top-0 z-10 grid divide-x divide-gray-200 bg-white pt-2 pb-2 ${SWIMLANE_GRID_COLS_CLASS[visibleColumnDefs.length]}`}
          >
            {visibleColumnDefs.map((c) => (
              <div key={c.key} className="flex items-center gap-2 px-4">
                {c.key === 'none' ? (
                  <span className="text-text-default text-sm font-semibold">
                    {c.title}
                  </span>
                ) : (
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-sm font-semibold ${RATING_COLORS[c.key as InterviewRating].bg} ${RATING_COLORS[c.key as InterviewRating].text}`}
                  >
                    {c.title}
                  </span>
                )}
                <span className="text-text-subtle text-sm">
                  {ratingTotals[c.key]}
                </span>
              </div>
            ))}
          </div>

          {swimlanes.map((lane, laneIndex) => {
            const collapsed = collapsedLanes.has(lane.key)
            return (
              <div
                key={lane.key}
                className={laneIndex % 2 === 1 ? 'bg-gray-50/60' : undefined}
              >
                <div
                  className={`grid w-max min-w-full border-t border-b border-gray-200 bg-inherit ${SWIMLANE_GRID_COLS_CLASS[visibleColumnDefs.length]}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleLane(lane.key)}
                    className="text-text-default hover:text-brand-blue sticky top-[2.2rem] left-0 z-[6] col-span-full flex w-fit items-center gap-1.5 bg-inherit px-4 py-2 text-sm font-medium"
                  >
                    {collapsed ? (
                      <ChevronRight size={14} />
                    ) : (
                      <ChevronDown size={14} />
                    )}
                    {lane.title}
                    <span className="text-text-subtle font-normal">
                      {lane.count}
                    </span>
                  </button>
                </div>
                {!collapsed && (
                  <div
                    className={`grid divide-x divide-gray-200 py-3 ${SWIMLANE_GRID_COLS_CLASS[visibleColumnDefs.length]}`}
                  >
                    {visibleColumnDefs.map((c) => (
                      <div key={c.key} className="flex flex-col gap-2 px-4">
                        {lane.byRating[c.key].map(
                          ({
                            application,
                            interview,
                            reviewerCount,
                            reviewedCount,
                          }) => (
                            <RatingCard
                              key={application.id}
                              application={application}
                              interview={interview}
                              interviewerName={null}
                              reviewerCount={reviewerCount}
                              reviewedCount={reviewedCount}
                              showInterviewer={false}
                              showRole={activeRole === 'all'}
                              backQuery={filterQuery}
                            />
                          )
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex divide-x divide-gray-200 overflow-x-auto rounded-lg border border-gray-200 pb-4">
          {ratingColumns.map((column) => (
            <RatingColumn
              key={column.key}
              ratingKey={column.key}
              title={column.title}
              rows={column.rows}
              showInterviewer
              showRole={activeRole === 'all'}
              nameByNuid={nameByNuid}
              backQuery={filterQuery}
            />
          ))}
        </div>
      )}

      <Dialog
        open={confirmingRelease !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmingRelease(null)
            setRelease.reset()
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmingRelease
                ? 'Release interview reviews?'
                : 'Hide interview reviews?'}
            </DialogTitle>
            <DialogDescription>
              {confirmingRelease
                ? `Every reviewer will be able to read all interview recording reviews for ${scopeLabel} in this cycle, including any still in draft. You can hide them again afterwards.`
                : `Reviewers will go back to seeing only their own interview recording review for ${scopeLabel} in this cycle.`}
            </DialogDescription>
          </DialogHeader>
          {setRelease.isError && (
            <p className="text-destructive text-sm">
              Couldn&apos;t update the gate. Try again.
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmingRelease(null)}
              disabled={setRelease.isPending}
            >
              Cancel
            </Button>
            <Button onClick={confirmRelease} disabled={setRelease.isPending}>
              {setRelease.isPending && (
                <Loader2 className="animate-spin" size={14} />
              )}
              {confirmingRelease ? 'Release' : 'Hide'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}

function RatingColumn({
  ratingKey,
  title,
  rows,
  showInterviewer,
  showRole,
  nameByNuid,
  backQuery,
}: {
  ratingKey: RatingKey
  title: string
  rows: Row[]
  showInterviewer: boolean
  showRole: boolean
  nameByNuid: Map<string, string>
  backQuery: string
}) {
  return (
    <div className="flex w-80 shrink-0 flex-col px-4 pt-3">
      <div className="mb-3 flex items-center gap-2">
        {ratingKey === 'none' ? (
          <span className="text-text-default text-sm font-semibold">
            {title}
          </span>
        ) : (
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-sm font-semibold ${RATING_COLORS[ratingKey as InterviewRating].bg} ${RATING_COLORS[ratingKey as InterviewRating].text}`}
          >
            {title}
          </span>
        )}
        <span className="text-text-subtle text-sm">{rows.length}</span>
      </div>
      <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto pr-1 pb-1">
        {rows.map(
          ({
            application,
            interview,
            interviewerNuid,
            reviewerCount,
            reviewedCount,
          }) => (
            <RatingCard
              key={application.id}
              application={application}
              interview={interview}
              interviewerName={
                interviewerNuid
                  ? (nameByNuid.get(interviewerNuid) ?? interviewerNuid)
                  : null
              }
              reviewerCount={reviewerCount}
              reviewedCount={reviewedCount}
              showInterviewer={showInterviewer}
              showRole={showRole}
              backQuery={backQuery}
            />
          )
        )}
      </div>
    </div>
  )
}

function RatingCard({
  application,
  interview,
  interviewerName,
  reviewerCount,
  reviewedCount,
  showInterviewer,
  showRole,
  backQuery,
}: {
  application: ApplicationSummary
  interview: Interview | null | undefined
  interviewerName: string | null
  reviewerCount: number
  reviewedCount: number
  showInterviewer: boolean
  showRole: boolean
  backQuery: string
}) {
  const state: ReviewState = interview?.submitted_at
    ? 'submitted'
    : interview
      ? 'draft'
      : 'none'

  // Don't show interview state badge when stage already conveys that info
  const showInterviewStateBadge =
    !application.stage ||
    !['interview_conducted', 'interview_review'].includes(application.stage)

  return (
    <Link
      href={`/reviewer/my-interviews/${application.id}?from=interview-ratings${
        backQuery ? `&ratingsQuery=${encodeURIComponent(backQuery)}` : ''
      }`}
      className="group flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="text-text-default truncate text-sm font-medium">
            {application.full_name || application.user_nuid}
          </p>
          {showRole && (
            <span
              className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium ${ROLE_CHIP_CLASS[application.role]}`}
            >
              {ROLE_LABEL[application.role]}
            </span>
          )}
        </div>
        <ArrowRight
          size={14}
          className="text-text-faint group-hover:text-brand-blue shrink-0 transition-transform group-hover:translate-x-1"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {showInterviewStateBadge && (
          <>
            <span
              className={`h-2 w-2 shrink-0 rounded-full border-2 ${REVIEW_STATE_DOT[state]}`}
            />
            <span
              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${REVIEW_STATE_BADGE[state]}`}
            >
              {state === 'submitted' && <CheckCircle2 className="h-3 w-3" />}
              {INTERVIEW_STATE_LABEL[state]}
            </span>
          </>
        )}
        {application.stage && (
          <span
            className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${stageBadge[application.stage]}`}
          >
            {stageLabel[application.stage]}
          </span>
        )}
        {interview?.rating && (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${RATING_COLORS[interview.rating].bg} ${RATING_COLORS[interview.rating].text}`}
          >
            {RATING_LABEL[interview.rating]}
          </span>
        )}
      </div>

      {showInterviewer && interviewerName && (
        <p className="text-text-subtle flex items-center gap-1 text-xs">
          <Clock className="h-3 w-3 shrink-0" />
          Interviewer: {interviewerName}
        </p>
      )}

      {reviewerCount > 0 && (
        <p
          className={`text-xs font-medium ${
            reviewedCount === reviewerCount
              ? 'text-green-700'
              : 'text-amber-700'
          }`}
        >
          {reviewedCount}/{reviewerCount} reviewed
        </p>
      )}
    </Link>
  )
}
