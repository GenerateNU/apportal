'use client'

import { useMemo, useState } from 'react'
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
import { useInterviewsByApplicationIdBatches } from '@/lib/queries/interviews'
import { RATING_OPTIONS } from '@/lib/interview-ratings'
import { ROLE_COLUMNS, ROLE_LABEL } from '@/lib/roles'
import type { ReviewState } from '../../my-reviews/constants'
import { ReviewRow } from '../../my-reviews/components/ReviewRow'
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
}

export function InterviewRatingsClient() {
  const { data: cycles = [] } = useCycles({})

  const [cycleId, setCycleId] = useState('')
  if (!cycleId && cycles.length > 0) {
    const defaultId = pickDefaultCycleId(cycles)
    if (defaultId) setCycleId(defaultId)
  }
  const [activeRole, setActiveRole] = useState<Role | 'all'>('all')

  const { data: applications = [] } = useApplications(
    {
      ...(cycleId && { cycle_id: cycleId }),
      ...(activeRole !== 'all' && { role: activeRole }),
    },
    undefined,
    { enabled: !!cycleId }
  )

  // Interview data for the whole cycle roster, in one batched request rather
  // than one per row.
  const applicationIds = useMemo(
    () => applications.map((a) => a.id),
    [applications]
  )
  const [interviewBatch] = useInterviewsByApplicationIdBatches(
    applicationIds.length > 0 ? [applicationIds] : []
  )
  const interviewByApplicationId = interviewBatch?.data

  const rows: Row[] = useMemo(
    () =>
      applications
        .map((application) => ({
          application,
          interview: interviewByApplicationId?.[application.id],
        }))
        .filter(
          ({ application, interview }) =>
            !!interview ||
            INTERVIEW_STAGES.includes(application.stage as ApplicationStage)
        ),
    [applications, interviewByApplicationId]
  )

  const buckets = useMemo(() => {
    const byRating: Record<InterviewRating | 'none', Row[]> = {
      must_hire: [],
      great: [],
      good: [],
      neutral: [],
      do_not_hire: [],
      none: [],
    }
    for (const row of rows) {
      const key = row.interview?.rating ?? 'none'
      byRating[key].push(row)
    }
    for (const key of Object.keys(byRating) as (InterviewRating | 'none')[]) {
      byRating[key].sort((a, b) =>
        (a.application.full_name || a.application.user_nuid).localeCompare(
          b.application.full_name || b.application.user_nuid
        )
      )
    }
    return byRating
  }, [rows])

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
      ) : (
        <>
          <RatingSection title="Interview" rows={buckets.none} />
          {RATING_OPTIONS.map((o) => (
            <RatingSection
              key={o.value}
              title={o.label}
              rows={buckets[o.value]}
            />
          ))}
        </>
      )}
    </PageContainer>
  )
}

function RatingSection({ title, rows }: { title: string; rows: Row[] }) {
  if (rows.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-text-faint text-xs font-semibold tracking-wide uppercase">
        {title} ({rows.length})
      </h2>
      <div className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white">
        {rows.map(({ application, interview }) => {
          const state: ReviewState = interview?.submitted_at
            ? 'submitted'
            : interview
              ? 'draft'
              : 'none'
          return (
            <ReviewRow
              key={application.id}
              href={`/reviewer/my-interviews/${application.id}`}
              name={application.full_name || application.user_nuid}
              email={application.email}
              stage={application.stage}
              state={state}
              stateLabel={INTERVIEW_STATE_LABEL[state]}
            />
          )
        })}
      </div>
    </div>
  )
}
