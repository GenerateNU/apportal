'use client'

import { AlertTriangle, Check } from 'lucide-react'
import type {
  InterviewerPlanPreview as InterviewerPlanPreviewType,
  PlannedApplication,
} from '@/generated/model'
import { AVAILABILITY_OPTIONS } from '@/lib/availability'

const dayLabel = (day: string) =>
  AVAILABILITY_OPTIONS.find((o) => o.key === day)?.label ?? day

type Queue = {
  id: string
  title: string
  members?: string
  day: string
  cap: number
  existing: number
  total: number
  applications: PlannedApplication[]
}

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

  const queues: Queue[] = [
    ...(plan.groups ?? []).map((g) => ({
      id: g.group_id,
      title: g.name,
      members: (g.members ?? []).map((m) => m.full_name).join(', '),
      day: g.day,
      cap: g.cap,
      existing: g.existing,
      total: g.total,
      applications: g.applications ?? [],
    })),
    ...interviewers.map((l) => ({
      id: l.lead_nuid,
      title: l.full_name || l.lead_nuid,
      day: l.day,
      cap: l.cap,
      existing: l.existing,
      total: l.total,
      applications: l.applications ?? [],
    })),
  ]

  const byDay = new Map<string, Queue[]>()
  for (const queue of queues) {
    const list = byDay.get(queue.day) ?? []
    list.push(queue)
    byDay.set(queue.day, list)
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
            No lead or group had spare capacity for these applicants. Raise the
            cap or add more.
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

      {[...byDay.entries()].map(([day, dayQueues]) => (
        <div key={day} className="flex flex-col gap-2">
          <h3 className="text-text-default text-sm font-semibold">
            {dayLabel(day)}
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {dayQueues.map((queue) => (
              <InterviewerQueue key={queue.id} queue={queue} />
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}

function InterviewerQueue({ queue }: { queue: Queue }) {
  const atCap = queue.total >= queue.cap
  const applications = queue.applications
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="text-text-default text-sm font-medium">
          {queue.title}
        </span>
        <span
          className={`text-xs ${atCap ? 'text-amber-700' : 'text-text-faint'}`}
        >
          {queue.total} of {queue.cap}
          {queue.existing > 0 && ` · ${queue.existing} already assigned`}
        </span>
      </div>
      {queue.members && (
        <p className="text-text-muted -mt-1 text-xs">{queue.members}</p>
      )}

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
