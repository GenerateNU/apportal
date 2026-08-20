'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
} from 'lucide-react'
import { PageContainer } from '@/components/PageContainer'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
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
import { useChiefs, useCurrentUser, useLeads } from '@/lib/queries/users'
import { RATING_LABEL } from '@/lib/interview-ratings'
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

  const [cycleId, setCycleId] = useState('')
  if (!cycleId && cycles.length > 0) {
    const defaultId = pickDefaultCycleId(cycles)
    if (defaultId) setCycleId(defaultId)
  }
  const [activeRole, setActiveRole] = useState<Role | 'all'>('all')
  const [groupByInterviewer, setGroupByInterviewer] = useState(true)
  const [interviewerFilter, setInterviewerFilter] = useState('all')
  const [collapsedLanes, setCollapsedLanes] = useState<Set<string>>(new Set())

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
    if (interviewerFilter === 'all') return rows
    if (interviewerFilter === 'unassigned') {
      return rows.filter((r) => !r.interviewerNuid)
    }
    return rows.filter((r) => r.interviewerNuid === interviewerFilter)
  }, [rows, interviewerFilter])

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
          {isChief && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={groupByInterviewer}
                onCheckedChange={(checked) =>
                  setGroupByInterviewer(checked === true)
                }
              />
              <Label className="cursor-pointer font-normal">
                Group by interviewer
              </Label>
            </label>
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
        <div className="overflow-x-auto pb-4">
          <div
            className={`grid gap-5 pb-3 ${SWIMLANE_GRID_COLS_CLASS[visibleColumnDefs.length]}`}
          >
            {visibleColumnDefs.map((c) => (
              <div key={c.key} className="flex items-center gap-2 px-1">
                <span className="text-text-default text-sm font-semibold">
                  {c.title}
                </span>
                <span className="text-text-subtle text-sm">
                  {ratingTotals[c.key]}
                </span>
              </div>
            ))}
          </div>

          {swimlanes.map((lane) => {
            const collapsed = collapsedLanes.has(lane.key)
            return (
              <div
                key={lane.key}
                className="border-t border-gray-100 py-3 first:border-t-0 first:pt-0"
              >
                <button
                  type="button"
                  onClick={() => toggleLane(lane.key)}
                  className="text-text-default hover:text-brand-blue mb-2 flex items-center gap-1.5 px-1 text-sm font-medium"
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
                {!collapsed && (
                  <div
                    className={`grid gap-5 ${SWIMLANE_GRID_COLS_CLASS[visibleColumnDefs.length]}`}
                  >
                    {visibleColumnDefs.map((c) => (
                      <div key={c.key} className="flex flex-col gap-2">
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
                              showRating={false}
                              showRole={activeRole === 'all'}
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
        <div className="flex gap-5 overflow-x-auto pb-4">
          {ratingColumns.map((column) => (
            <RatingColumn
              key={column.key}
              title={column.title}
              rows={column.rows}
              showInterviewer
              showRating={false}
              showRole={activeRole === 'all'}
              nameByNuid={nameByNuid}
            />
          ))}
        </div>
      )}
    </PageContainer>
  )
}

function RatingColumn({
  title,
  rows,
  showInterviewer,
  showRating,
  showRole,
  nameByNuid,
}: {
  title: string
  rows: Row[]
  showInterviewer: boolean
  showRating: boolean
  showRole: boolean
  nameByNuid: Map<string, string>
}) {
  return (
    <div className="flex w-80 shrink-0 flex-col">
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className="text-text-default text-sm font-semibold">{title}</span>
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
              showRating={showRating}
              showRole={showRole}
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
  showRating,
  showRole,
}: {
  application: ApplicationSummary
  interview: Interview | null | undefined
  interviewerName: string | null
  reviewerCount: number
  reviewedCount: number
  showInterviewer: boolean
  showRating: boolean
  showRole: boolean
}) {
  const state: ReviewState = interview?.submitted_at
    ? 'submitted'
    : interview
      ? 'draft'
      : 'none'

  return (
    <Link
      href={`/reviewer/my-interviews/${application.id}`}
      className="group flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-text-default truncate text-sm font-medium">
            {application.full_name || application.user_nuid}
          </p>
          <p className="text-text-subtle truncate text-xs">
            {application.email}
          </p>
        </div>
        <ArrowRight
          size={14}
          className="text-text-faint group-hover:text-brand-blue mt-0.5 shrink-0 transition-transform group-hover:translate-x-1"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {showRole && (
          <span
            className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${ROLE_CHIP_CLASS[application.role]}`}
          >
            {ROLE_LABEL[application.role]}
          </span>
        )}
        <span
          className={`h-2 w-2 shrink-0 rounded-full border-2 ${REVIEW_STATE_DOT[state]}`}
        />
        <span
          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${REVIEW_STATE_BADGE[state]}`}
        >
          {state === 'submitted' && <CheckCircle2 className="h-3 w-3" />}
          {INTERVIEW_STATE_LABEL[state]}
        </span>
        {application.stage && (
          <span
            className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${stageBadge[application.stage]}`}
          >
            {stageLabel[application.stage]}
          </span>
        )}
        {showRating && interview?.rating && (
          <span className="bg-brand-blue/10 text-brand-blue rounded-md px-1.5 py-0.5 text-xs font-medium">
            {interview.rating.replace('_', ' ')}
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
