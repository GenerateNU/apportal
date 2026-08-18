'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, Clock } from 'lucide-react'
import { PageContainer } from '@/components/PageContainer'
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
import { RATING_OPTIONS } from '@/lib/interview-ratings'
import { ROLE_COLUMNS, ROLE_LABEL } from '@/lib/roles'
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

type GroupBy = 'rating' | 'interviewer'

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
  const [groupBy, setGroupBy] = useState<GroupBy>('rating')

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

  // Nuid -> display name, for the interviewer shown per row/column — same
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

  const ratingColumns = useMemo(() => {
    const byRating: Record<InterviewRating | 'none', Row[]> = {
      must_hire: [],
      great: [],
      good: [],
      neutral: [],
      do_not_hire: [],
      none: [],
    }
    for (const row of rows) {
      byRating[row.interview?.rating ?? 'none'].push(row)
    }
    for (const key of Object.keys(byRating) as (InterviewRating | 'none')[]) {
      byRating[key].sort(byName)
    }
    return [
      { key: 'none', title: 'Interview', rows: byRating.none },
      ...RATING_OPTIONS.map((o) => ({
        key: o.value,
        title: o.label,
        rows: byRating[o.value],
      })),
    ].filter((c) => c.rows.length > 0)
  }, [rows])

  const interviewerColumns = useMemo(() => {
    const byInterviewer = new Map<string, Row[]>()
    for (const row of rows) {
      const key = row.interviewerNuid ?? 'unassigned'
      const list = byInterviewer.get(key) ?? []
      list.push(row)
      byInterviewer.set(key, list)
    }
    const columns = [...byInterviewer.entries()].map(([nuid, colRows]) => ({
      key: nuid,
      title:
        nuid === 'unassigned' ? 'Unassigned' : (nameByNuid.get(nuid) ?? nuid),
      rows: colRows.sort(byName),
    }))
    columns.sort((a, b) => {
      if (a.key === 'unassigned') return 1
      if (b.key === 'unassigned') return -1
      return a.title.localeCompare(b.title)
    })
    return columns
  }, [rows, nameByNuid])

  const columns = groupBy === 'rating' ? ratingColumns : interviewerColumns

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
          <Select
            value={groupBy}
            onValueChange={(v) => setGroupBy(v as GroupBy)}
          >
            <SelectTrigger className="w-48" aria-label="Group by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rating">Group by rating</SelectItem>
              <SelectItem value="interviewer">Group by interviewer</SelectItem>
            </SelectContent>
          </Select>

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
      ) : groupBy === 'interviewer' && !isChief ? (
        <p className="text-text-faint px-1 text-sm">
          Grouping by interviewer needs chief/admin access, since it reads every
          applicant&apos;s assignment.
        </p>
      ) : (
        <div className="flex gap-5 overflow-x-auto pb-4">
          {columns.map((column) => (
            <RatingColumn
              key={column.key}
              title={column.title}
              rows={column.rows}
              showInterviewer={groupBy === 'rating'}
              showRating={groupBy === 'interviewer'}
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
  nameByNuid,
}: {
  title: string
  rows: Row[]
  showInterviewer: boolean
  showRating: boolean
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
}: {
  application: ApplicationSummary
  interview: Interview | null | undefined
  interviewerName: string | null
  reviewerCount: number
  reviewedCount: number
  showInterviewer: boolean
  showRating: boolean
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
