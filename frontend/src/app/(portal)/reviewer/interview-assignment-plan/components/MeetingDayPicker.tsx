'use client'

import { DaySelect } from './DaySelect'

export type DraftLeadDay = { leadNuid: string; day: string }

type Lead = { nuid: string; full_name: string }

// Parallel to TeamBuilder, but simpler: there's no exclusivity to enforce —
// multiple leads can (and often do) share a day, that's the whole point of
// the day-matching this feeds. Meeting days are ephemeral, re-declared every
// planning run, same as teams there.
export function MeetingDayPicker({
  leads,
  value,
  onChange,
}: {
  leads: Lead[]
  value: DraftLeadDay[]
  onChange: (value: DraftLeadDay[]) => void
}) {
  const dayOf = (nuid: string) =>
    value.find((v) => v.leadNuid === nuid)?.day ?? ''

  function setDay(nuid: string, day: string) {
    const next = value.filter((v) => v.leadNuid !== nuid)
    if (day) next.push({ leadNuid: nuid, day })
    onChange(next)
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-text-default text-sm font-semibold">
          Meeting days
        </h2>
        <p className="text-text-muted mt-0.5 text-xs">
          Set each lead&apos;s meeting day to match them against
          applicants&apos; availability. Leads on Any day can take any
          applicant; skipped leads get none. Not saved; set it each time you
          plan.
        </p>
      </div>

      {leads.length === 0 ? (
        <p className="text-text-faint rounded-xl border border-dashed border-gray-200 bg-white px-4 py-6 text-center text-sm">
          No leads found.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {leads.map((lead) => (
            <div
              key={lead.nuid}
              className="flex items-center justify-between gap-2 rounded-xl border border-gray-100 bg-white p-3"
            >
              <span className="text-text-default truncate text-sm font-medium">
                {lead.full_name}
              </span>
              <DaySelect
                value={dayOf(lead.nuid)}
                onChange={(day) => setDay(lead.nuid, day)}
                label={`Meeting day for ${lead.full_name}`}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
