'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AVAILABILITY_OPTIONS } from '@/lib/availability'

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
          Declare each lead&apos;s meeting day for this run — used to match them
          against applicants&apos; availability. Not saved; re-declare it each
          time you plan.
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
              <Select
                value={dayOf(lead.nuid)}
                onValueChange={(day) => setDay(lead.nuid, day)}
              >
                <SelectTrigger
                  className="h-8 w-40 text-xs"
                  aria-label={`Meeting day for ${lead.full_name}`}
                >
                  <SelectValue placeholder="No day set" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABILITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.key} value={opt.key}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
