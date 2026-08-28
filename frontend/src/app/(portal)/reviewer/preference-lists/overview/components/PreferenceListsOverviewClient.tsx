'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MEETING_DAY_LABEL } from '@/app/(portal)/reviewer/applications/components/meetingAvailability'
import type { PreferenceListDetail, Role } from '@/lib/api/types'
import { pickDefaultCycleId, useCycles } from '@/lib/queries/cycles'
import { usePreferenceListDetails } from '@/lib/queries/preference-lists'
import { useChiefs, useLeads } from '@/lib/queries/users'
import {
  PREFERENCE_LIST_STATUS_BADGE,
  PREFERENCE_LIST_STATUS_LABEL,
} from '@/lib/preference-list-status'
import { ROLE_COLUMNS, ROLE_LABEL } from '@/lib/roles'

export function PreferenceListsOverviewClient() {
  const searchParams = useSearchParams()
  const { data: cycles = [] } = useCycles({})
  const { data: leads = [] } = useLeads()
  const { data: chiefs = [] } = useChiefs()

  const [cycleId, setCycleId] = useState(searchParams.get('cycle') ?? '')
  if (!cycleId && cycles.length > 0) {
    const defaultId = pickDefaultCycleId(cycles)
    if (defaultId) setCycleId(defaultId)
  }

  const [role, setRole] = useState<Role>(ROLE_COLUMNS[0])

  const { data: lists = [], isLoading } = usePreferenceListDetails(cycleId)

  const nameByNuid = useMemo(() => {
    const byNuid = new Map<string, string>()
    for (const u of [...leads, ...chiefs]) byNuid.set(u.nuid, u.full_name)
    return byNuid
  }, [leads, chiefs])

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
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

        <div className="flex rounded-md border border-gray-200 bg-white">
          {ROLE_COLUMNS.map((r, i) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`px-3 py-1.5 text-sm transition-colors ${i === 0 ? 'rounded-l-md' : ''} ${
                i === ROLE_COLUMNS.length - 1 ? 'rounded-r-md' : ''
              } ${
                role === r
                  ? 'text-text-default bg-gray-100 font-medium'
                  : 'text-text-subtle hover:text-text-secondary'
              }`}
            >
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      {!cycleId ? (
        <p className="text-text-faint px-1 text-sm">No cycles yet.</p>
      ) : isLoading ? (
        <p className="text-text-faint px-1 text-sm">Loading…</p>
      ) : lists.length === 0 ? (
        <p className="text-text-faint px-1 text-sm">
          No preference list groups yet for this cycle.
        </p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {lists.map((list) => (
            <GroupColumn
              key={list.id}
              list={list}
              role={role}
              nameByNuid={nameByNuid}
            />
          ))}
        </div>
      )}
    </>
  )
}

function GroupColumn({
  list,
  role,
  nameByNuid,
}: {
  list: PreferenceListDetail
  role: Role
  nameByNuid: Map<string, string>
}) {
  const entries = list.entries.filter((e) => e.application_role === role)
  const memberNames = list.members.map(
    (m) => nameByNuid.get(m.lead_nuid) ?? m.lead_nuid
  )

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-lg border border-gray-200 bg-white">
      <Link
        href={`/reviewer/preference-lists/${list.id}`}
        className="group flex flex-col gap-1.5 border-b border-gray-100 p-3"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-text-default truncate text-sm font-medium">
            {list.name}
          </p>
          <ArrowRight
            size={14}
            className="text-text-faint group-hover:text-brand-blue shrink-0 transition-transform group-hover:translate-x-1"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${PREFERENCE_LIST_STATUS_BADGE[list.status]}`}
          >
            {PREFERENCE_LIST_STATUS_LABEL[list.status]}
          </span>
          <span className="text-text-subtle text-xs">
            {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}
          </span>
          {list.meeting_day && (
            <span className="bg-brand-blue/10 text-brand-blue rounded-md px-1.5 py-0.5 text-xs font-medium">
              Meets {MEETING_DAY_LABEL[list.meeting_day]}
            </span>
          )}
        </div>
        <p className="text-text-subtle truncate text-xs">
          {memberNames.length > 0 ? memberNames.join(', ') : 'No members yet'}
        </p>
      </Link>

      <div className="flex max-h-[65vh] flex-col gap-0.5 overflow-y-auto p-2">
        {entries.length === 0 ? (
          <p className="text-text-faint px-2 py-1.5 text-xs">
            No entries yet for this role.
          </p>
        ) : (
          entries.map((entry, i) => (
            <Link
              key={entry.id}
              href={`/reviewer/applications/${entry.application_id}`}
              className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-gray-50"
            >
              <span className="text-text-faint w-4 shrink-0 text-right text-xs font-medium">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-text-default truncate text-sm">
                  {entry.full_name || entry.email}
                </p>
                {entry.reasoning && (
                  <p
                    className="text-text-faint truncate text-xs"
                    title={entry.reasoning}
                  >
                    {entry.reasoning}
                  </p>
                )}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
