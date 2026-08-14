'use client'

import { AlertTriangle, Check } from 'lucide-react'
import type {
  InterviewReviewPlanPreview as InterviewReviewPlanPreviewType,
  PlannedReviewer,
} from '@/generated/model'
import { AVAILABILITY_OPTIONS } from '@/lib/availability'

const dayLabel = (day: string) =>
  AVAILABILITY_OPTIONS.find((o) => o.key === day)?.label ?? day

// Parallel to the written-review planner's PlanPreview, grouped by declared
// meeting day instead of team.
export function ReviewerPlanPreview({
  plan,
}: {
  plan: InterviewReviewPlanPreviewType
}) {
  const reviewers = plan.reviewers ?? []
  const warnings = plan.warnings ?? []
  const underCovered = plan.under_covered ?? []
  const noDayMatch = plan.no_day_match ?? []

  const byDay = new Map<string, PlannedReviewer[]>()
  for (const lead of reviewers) {
    const group = byDay.get(lead.day) ?? []
    group.push(lead)
    byDay.set(lead.day, group)
  }

  const depths = Object.keys(plan.coverage_counts)
    .map(Number)
    .sort((a, b) => a - b)

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-white p-4">
        <Stat label="Applicants" value={plan.pool_size} />
        <Stat label="Reviews to create" value={plan.total_added} />
        <Stat label="Target coverage" value={`${plan.coverage} per app`} />
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {depths.map((depth) => (
            <span
              key={depth}
              className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
                depth >= plan.coverage
                  ? 'bg-chip-1-bg text-chip-1-text'
                  : 'bg-chip-3-bg text-chip-3-text'
              }`}
            >
              {plan.coverage_counts[depth]} app
              {plan.coverage_counts[depth] === 1 ? '' : 's'} · {depth} reviewer
              {depth === 1 ? '' : 's'}
            </span>
          ))}
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
          {warnings.map((warning) => (
            <p
              key={warning}
              className="flex items-start gap-2 text-xs text-amber-900"
            >
              <AlertTriangle size={14} className="mt-px flex-shrink-0" />
              {warning}
            </p>
          ))}
        </div>
      )}

      {underCovered.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <h3 className="text-text-default text-sm font-semibold">
            Under-covered ({underCovered.length})
          </h3>
          <p className="text-text-muted mt-0.5 mb-2 text-xs">
            These applicants could not reach {plan.coverage} reviewers. Raise
            the cap, or add another lead.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {underCovered.map((app) => (
              <span
                key={app.application_id}
                className="text-text-muted inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs"
              >
                {app.full_name}
              </span>
            ))}
          </div>
        </div>
      )}

      {noDayMatch.length > 0 && (
        <p className="text-text-muted text-xs">
          {noDayMatch.length} applicant
          {noDayMatch.length === 1 ? '' : 's'} had at least one reviewer
          assigned off their available day (the best-effort fallback fired).
        </p>
      )}

      {[...byDay.entries()].map(([day, leads]) => (
        <div key={day} className="flex flex-col gap-2">
          <h3 className="text-text-default text-sm font-semibold">
            {dayLabel(day)}
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {leads.map((lead) => (
              <ReviewerQueue key={lead.lead_nuid} lead={lead} />
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}

function ReviewerQueue({ lead }: { lead: PlannedReviewer }) {
  const atCap = lead.total >= lead.cap
  const applications = lead.applications ?? []
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-white p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-text-default text-sm font-medium">
          {lead.full_name || lead.lead_nuid}
        </span>
        <span
          className={`text-xs ${atCap ? 'text-amber-700' : 'text-text-faint'}`}
        >
          {lead.total} of {lead.cap}
          {lead.existing > 0 && ` · ${lead.existing} already assigned`}
        </span>
      </div>

      {applications.length === 0 ? (
        <p className="text-text-faint text-xs">Nothing assigned.</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {applications.map((app) => (
            <li
              key={app.application_id}
              className="flex items-center gap-2 text-xs"
            >
              {app.already_assigned ? (
                <Check size={12} className="text-text-faint flex-shrink-0" />
              ) : (
                <span className="bg-primary/40 h-1.5 w-1.5 flex-shrink-0 rounded-full" />
              )}
              <span className="text-text-default truncate">
                {app.full_name}
              </span>
              {app.already_assigned && (
                <span className="text-text-faint flex-shrink-0">existing</span>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col">
      <span className="text-text-faint text-xs">{label}</span>
      <span className="text-text-default text-sm font-semibold">{value}</span>
    </div>
  )
}
