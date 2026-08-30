'use client'

import { ChevronDown, ChevronRight, X } from 'lucide-react'
import { DateTimePicker } from '@/components/ui/datetime-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import {
  AVAILABILITY_DAY_OPTIONS,
  MEETING_DAY_LABEL,
} from '@/app/(portal)/reviewer/applications/components/meetingAvailability'
import type { MeetingDay, PreferenceListMember, Role } from '@/lib/api/types'
import { ROLE_COLUMNS, ROLE_LABEL } from '@/lib/roles'

// Meeting day, deadlines and membership are set once and then read at a
// glance — folded away so the ranking, which is what the page is for, isn't
// pushed below a screenful of configuration.
export function GroupSettings({
  open,
  onToggle,
  groupLocked,
  isChief,
  meetingDay,
  onMeetingDayChange,
  closesAtByRole,
  onSetDeadline,
  deadlineError,
  members,
  nameByNuid,
  availableToAdd,
  maxMembers,
  onAddMember,
  onRemoveMember,
}: {
  open: boolean
  onToggle: () => void
  groupLocked: boolean
  isChief: boolean
  meetingDay?: MeetingDay | null
  onMeetingDayChange: (day: MeetingDay | null) => void
  closesAtByRole: Record<Role, string | undefined>
  onSetDeadline: (role: Role, closesAt: string | null) => void
  deadlineError: boolean
  members: PreferenceListMember[]
  nameByNuid: Map<string, string>
  availableToAdd: { nuid: string; full_name: string }[]
  maxMembers: number
  onAddMember: (nuid: string) => void
  onRemoveMember: (memberId: string) => void
}) {
  const atMemberCap = members.length >= maxMembers
  const memberNames = members
    .map((m) => nameByNuid.get(m.lead_nuid) ?? m.lead_nuid)
    .join(', ')

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-5 py-3 text-left"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="text-text-faint text-xs font-semibold tracking-wide uppercase">
          Group settings
        </span>
        {!open && (
          <span className="text-text-subtle truncate text-xs">
            {meetingDay
              ? `Meets ${MEETING_DAY_LABEL[meetingDay]}`
              : 'No meeting day'}
            {' · '}
            {members.length}/{maxMembers} members
            {memberNames && ` · ${memberNames}`}
          </span>
        )}
      </button>

      {open && (
        <div className="flex flex-col gap-5 border-t border-gray-100 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-text-muted font-medium">Meeting day:</span>
            <Select
              value={meetingDay ?? 'none'}
              onValueChange={(value) =>
                onMeetingDayChange(
                  value === 'none' ? null : (value as MeetingDay)
                )
              }
              disabled={groupLocked}
            >
              <SelectTrigger className="w-48" aria-label="Meeting day">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not set</SelectItem>
                {AVAILABILITY_DAY_OPTIONS.map((d) => (
                  <SelectItem key={d.day} value={d.day}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isChief && (
            // Every role, not just the ones in view: the deadline is a
            // cycle-wide setting, and hiding one behind a filter chip would
            // be a trap.
            <div className="flex flex-col gap-2 text-sm">
              {ROLE_COLUMNS.map((r) => {
                const closesAt = closesAtByRole[r]
                return (
                  <div key={r} className="flex flex-wrap items-center gap-2">
                    <span className="text-text-muted font-medium">
                      Deadline for every {ROLE_LABEL[r]} list this cycle:
                    </span>
                    <DateTimePicker
                      value={closesAt ? new Date(closesAt) : undefined}
                      onValueChange={(date) =>
                        onSetDeadline(r, date.toISOString())
                      }
                      placeholder="No deadline set"
                    />
                    {closesAt && (
                      <button
                        type="button"
                        onClick={() => onSetDeadline(r, null)}
                        className="text-text-faint hover:text-text-muted inline-flex items-center gap-1 text-xs"
                      >
                        <X size={12} />
                        Clear
                      </button>
                    )}
                  </div>
                )
              })}
              {deadlineError && (
                <span className="text-xs text-red-600">
                  Couldn&apos;t save the deadline — try again.
                </span>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-text-muted text-sm font-medium">
              Members ({members.length}/{maxMembers})
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {members.map((m) => (
                <span
                  key={m.id}
                  className="bg-muted inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm"
                >
                  {nameByNuid.get(m.lead_nuid) ?? m.lead_nuid}
                  {!groupLocked && (
                    <button
                      type="button"
                      onClick={() => onRemoveMember(m.id)}
                      aria-label={`Remove ${nameByNuid.get(m.lead_nuid) ?? m.lead_nuid}`}
                      className="text-text-faint hover:text-text-muted"
                    >
                      <X size={12} />
                    </button>
                  )}
                </span>
              ))}
            </div>
            {!groupLocked && !atMemberCap && (
              <SearchableSelect
                options={availableToAdd.map((u) => ({
                  value: u.nuid,
                  label: u.full_name,
                }))}
                onValueChange={onAddMember}
                placeholder="Add a member…"
                searchPlaceholder="Search leads…"
                emptyText="No matching leads."
                className="w-64"
                ariaLabel="Add a member"
              />
            )}
            {!groupLocked && atMemberCap && (
              <p className="text-text-faint text-xs">
                This group has reached the maximum of {maxMembers} members.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
