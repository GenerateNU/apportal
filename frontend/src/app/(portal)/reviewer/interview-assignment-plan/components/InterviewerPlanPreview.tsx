'use client'

import { AlertTriangle, Check } from 'lucide-react'
import type {
  InterviewerPlanPreview as InterviewerPlanPreviewType,
  PlannedInterviewer,
} from '@/generated/model'
import { AVAILABILITY_OPTIONS } from '@/lib/availability'

const dayLabel = (day: string) =>
  AVAILABILITY_OPTIONS.find((o) => o.key === day)?.label ?? day

// Parallel to the written-review planner's PlanPreview: read-only, nothing
// here writes. Grouped by declared meeting day instead of team.
export function InterviewerPlanPreview({
  plan,
}: {
  plan: InterviewerPlanPreviewType
}) {
  const interviewers = plan.interviewers ?? []
  const warnings = plan.warnings ?? []
  const unassigned = plan.unassigned ?? []
  const noDayMatch = plan.no_day_match ?? []

  const byDay = new Map<string, PlannedInterviewer[]>()
  for (const lead of interviewers) {
    const group = byDay.get(lead.day) ?? []
    group.push(lead)
    byDay.set(lead.day, group)
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-white p-4">
        <Stat label="Applicants" value={plan.pool_size} />
        <Stat label="Interviewers to assign" value={plan.total_added} />
        {noDayMatch.length > 0 && (
          <Stat label="Assigned off-day" value={noDayMatch.length} />
        )}
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

      {unassigned.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <h3 className="text-text-default text-sm font-semibold">
            Unassigned ({unassigned.length})
          </h3>
          <p className="text-text-muted mt-0.5 mb-2 text-xs">
            No lead had spare capacity for these applicants. Raise the cap or
            add leads.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {unassigned.map((app) => (
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

      {[...byDay.entries()].map(([day, leads]) => (
        <div key={day} className="flex flex-col gap-2">
          <h3 className="text-text-default text-sm font-semibold">
            {dayLabel(day)}
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {leads.map((lead) => (
              <InterviewerQueue key={lead.lead_nuid} lead={lead} />
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}

function InterviewerQueue({ lead }: { lead: PlannedInterviewer }) {
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
