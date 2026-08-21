'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowLeft, ArrowUp, Lock, Trash2, X } from 'lucide-react'
import { PageContainer } from '@/components/PageContainer'
import { Button } from '@/components/ui/button'
import { DateTimePicker } from '@/components/ui/datetime-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { APIError } from '@/lib/api/client'
import type { MeetingDay, PreferenceListStatus, Role } from '@/lib/api/types'
import { useApplications } from '@/lib/queries/applications'
import {
  useAddPreferenceListMember,
  useDeletePreferenceList,
  useDeletePreferenceListEntry,
  useLeadMeetingAvailability,
  usePreferenceList,
  usePreferenceListDeadline,
  useRemovePreferenceListMember,
  useReorderPreferenceListEntries,
  useSetPreferenceListDeadline,
  useSetPreferenceListMeetingDay,
  useUpdatePreferenceList,
  useUpsertPreferenceListEntry,
} from '@/lib/queries/preference-lists'
import { useChiefs, useLeads } from '@/lib/queries/users'
import { ROLE_CHIP_CLASS, ROLE_LABEL } from '@/lib/roles'

// True/false once we know; null when this lead has no usable answer at all
// (no application, or one that predates the availability question).
function isAvailableOn(
  options: string[] | undefined,
  day: MeetingDay
): boolean | null {
  if (!options) return null
  if (options.length === 0) return null
  return options.some((o) => o.toLowerCase().includes(day))
}

function availabilityBadge(available: boolean | null) {
  if (available === null) return undefined
  return available
    ? { label: 'Free', className: 'bg-green-50 text-green-700' }
    : { label: 'Busy', className: 'bg-red-50 text-red-700' }
}

const STATUS_BADGE: Record<PreferenceListStatus, string> = {
  draft: 'bg-gray-100 text-gray-500',
  submitted: 'bg-green-50 text-green-700',
}

const STATUS_LABEL: Record<PreferenceListStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
}

export function PreferenceListDetailClient({
  id,
  isChief,
}: {
  id: string
  isChief: boolean
}) {
  const {
    data: list,
    isLoading,
    isError,
    error,
  } = usePreferenceList(id, { poll: true })
  const { data: leads = [] } = useLeads()
  const { data: chiefs = [] } = useChiefs()

  const nameByNuid = useMemo(() => {
    const m = new Map<string, string>()
    for (const u of [...leads, ...chiefs]) m.set(u.nuid, u.full_name)
    return m
  }, [leads, chiefs])

  // Every reviewer's own availability, fetched once for the whole page
  // (not per row) — used to flag who's free for the list's chosen meeting
  // day, both on existing member chips and the add-member picker.
  const allReviewerNuids = useMemo(
    () => [...new Set([...leads, ...chiefs].map((u) => u.nuid))],
    [leads, chiefs]
  )
  const { data: availabilityByNuid } =
    useLeadMeetingAvailability(allReviewerNuids)

  const { data: deadline } = usePreferenceListDeadline(
    list?.cycle_id ?? '',
    (list?.application_role ?? 'software_engineer') as Role
  )
  const locked = !!(
    deadline?.closes_at && new Date(deadline.closes_at) < new Date()
  )

  const updateList = useUpdatePreferenceList()
  const deleteList = useDeletePreferenceList()
  const addMember = useAddPreferenceListMember()
  const removeMember = useRemovePreferenceListMember()
  const upsertEntry = useUpsertPreferenceListEntry()
  const deleteEntry = useDeletePreferenceListEntry()
  const reorderEntries = useReorderPreferenceListEntries()
  const setDeadline = useSetPreferenceListDeadline()
  const setMeetingDay = useSetPreferenceListMeetingDay()

  const [name, setName] = useState('')
  const [nameSeeded, setNameSeeded] = useState(false)
  if (!nameSeeded && list) {
    setName(list.name)
    setNameSeeded(true)
  }

  const { data: applications = [] } = useApplications(
    list ? { cycle_id: list.cycle_id, role: list.application_role } : undefined,
    undefined,
    { enabled: !!list }
  )

  if (isError) {
    const notFound = error instanceof APIError && error.status === 404
    return (
      <PageContainer>
        <Link
          href="/reviewer/preference-lists"
          className="text-text-muted hover:text-text-default inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft size={14} />
          Back to preference lists
        </Link>
        <p className="text-text-faint text-sm">
          {notFound
            ? "This preference list doesn't exist, or you don't have access to it."
            : 'Something went wrong loading this preference list.'}
        </p>
      </PageContainer>
    )
  }

  if (isLoading || !list) {
    return (
      <PageContainer>
        <p className="text-text-faint text-sm">Loading…</p>
      </PageContainer>
    )
  }

  const memberNuids = new Set(list.members.map((m) => m.lead_nuid))
  const availableToAdd = [...leads, ...chiefs]
    .filter(
      (u, i, arr) =>
        arr.findIndex((x) => x.nuid === u.nuid) === i &&
        !memberNuids.has(u.nuid)
    )
    .sort((a, b) => a.full_name.localeCompare(b.full_name))

  const meetingDay = list.meeting_day

  const entryApplicationIds = new Set(list.entries.map((e) => e.application_id))
  const availableApplications = applications
    .filter((a) => !entryApplicationIds.has(a.id))
    .sort((a, b) =>
      (a.full_name || a.user_nuid).localeCompare(b.full_name || b.user_nuid)
    )

  function saveName() {
    const trimmed = name.trim()
    if (!list || !trimmed || trimmed === list.name) return
    updateList.mutate({
      id: list.id,
      cycleId: list.cycle_id,
      role: list.application_role,
      body: { name: trimmed },
    })
  }

  function toggleSubmitted() {
    if (!list) return
    updateList.mutate({
      id: list.id,
      cycleId: list.cycle_id,
      role: list.application_role,
      body: { status: list.status === 'submitted' ? 'draft' : 'submitted' },
    })
  }

  function moveEntry(index: number, direction: -1 | 1) {
    if (!list) return
    const target = index + direction
    if (target < 0 || target >= list.entries.length) return
    const ids = list.entries.map((e) => e.application_id)
    const [moved] = ids.splice(index, 1)
    ids.splice(target, 0, moved)
    reorderEntries.mutate({ listId: list.id, applicationIds: ids })
  }

  return (
    <PageContainer>
      <Link
        href="/reviewer/preference-lists"
        className="text-text-muted hover:text-text-default inline-flex w-fit items-center gap-1 text-sm"
      >
        <ArrowLeft size={14} />
        Back to preference lists
      </Link>

      {locked && (
        <div className="border-border bg-muted/40 text-text-muted flex items-center gap-2 rounded-lg border px-4 py-3 text-sm">
          <Lock size={14} />
          The submission deadline for this cycle/role has passed. This list is
          read-only.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            disabled={locked}
            className="max-w-sm text-lg font-semibold"
          />
          <span
            className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${ROLE_CHIP_CLASS[list.application_role]}`}
          >
            {ROLE_LABEL[list.application_role]}
          </span>
          <span
            className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[list.status]}`}
          >
            {STATUS_LABEL[list.status]}
          </span>
          {meetingDay && (
            <span className="bg-brand-blue/10 text-brand-blue shrink-0 rounded-md px-2 py-0.5 text-xs font-medium">
              Meets {MEETING_DAY_LABEL[meetingDay]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={toggleSubmitted}
            disabled={locked || updateList.isPending}
          >
            {list.status === 'submitted' ? 'Mark as draft' : 'Submit'}
          </Button>
          {isChief && (
            <Button
              variant="outline"
              onClick={() =>
                deleteList.mutate({
                  id: list.id,
                  cycleId: list.cycle_id,
                  role: list.application_role,
                })
              }
              disabled={deleteList.isPending}
            >
              <Trash2 data-icon="inline-start" size={14} />
              Delete list
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm">
        <span className="text-text-muted font-medium">Meeting day:</span>
        <Select
          value={meetingDay ?? 'none'}
          onValueChange={(value) =>
            setMeetingDay.mutate({
              id: list.id,
              meetingDay: value === 'none' ? null : (value as MeetingDay),
            })
          }
          disabled={locked}
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
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm">
          <span className="text-text-muted font-medium">
            Deadline for every {ROLE_LABEL[list.application_role]} list this
            cycle:
          </span>
          <DateTimePicker
            value={
              deadline?.closes_at ? new Date(deadline.closes_at) : undefined
            }
            onValueChange={(date) =>
              setDeadline.mutate({
                cycleId: list.cycle_id,
                role: list.application_role,
                closesAt: date.toISOString(),
              })
            }
            placeholder="No deadline set"
          />
          {deadline?.closes_at && (
            <button
              type="button"
              onClick={() =>
                setDeadline.mutate({
                  cycleId: list.cycle_id,
                  role: list.application_role,
                  closesAt: null,
                })
              }
              className="text-text-faint hover:text-text-muted inline-flex items-center gap-1 text-xs"
            >
              <X size={12} />
              Clear
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-text-faint text-xs font-semibold tracking-wide uppercase">
          Members
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {list.members.map((m) => {
            const badge = meetingDay
              ? availabilityBadge(
                  isAvailableOn(
                    availabilityByNuid?.get(m.lead_nuid),
                    meetingDay
                  )
                )
              : undefined
            return (
              <span
                key={m.id}
                className="bg-muted inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm"
              >
                {nameByNuid.get(m.lead_nuid) ?? m.lead_nuid}
                {badge && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                )}
                {!locked && (
                  <button
                    type="button"
                    onClick={() =>
                      removeMember.mutate({ listId: list.id, memberId: m.id })
                    }
                    aria-label={`Remove ${nameByNuid.get(m.lead_nuid) ?? m.lead_nuid}`}
                    className="text-text-faint hover:text-text-muted"
                  >
                    <X size={12} />
                  </button>
                )}
              </span>
            )
          })}
        </div>
        {!locked && (
          <SearchableSelect
            options={availableToAdd.map((u) => ({
              value: u.nuid,
              label: u.full_name,
              badge: meetingDay
                ? availabilityBadge(
                    isAvailableOn(availabilityByNuid?.get(u.nuid), meetingDay)
                  )
                : undefined,
            }))}
            onValueChange={(nuid) =>
              addMember.mutate({ listId: list.id, leadNuid: nuid })
            }
            placeholder="Add a member…"
            searchPlaceholder="Search leads…"
            emptyText="No matching leads."
            className="w-64"
            ariaLabel="Add a member"
          />
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-text-faint text-xs font-semibold tracking-wide uppercase">
          Applicants
        </h2>
        <div className="flex flex-col gap-2">
          {list.entries.map((entry, index) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              index={index}
              total={list.entries.length}
              locked={locked}
              onMove={(direction) => moveEntry(index, direction)}
              onRemove={() =>
                deleteEntry.mutate({
                  listId: list.id,
                  applicationId: entry.application_id,
                })
              }
              onSaveReasoning={(reasoning) =>
                upsertEntry.mutate({
                  listId: list.id,
                  applicationId: entry.application_id,
                  reasoning,
                })
              }
            />
          ))}
          {list.entries.length === 0 && (
            <p className="text-text-faint text-sm">
              No applicants on this list yet.
            </p>
          )}
        </div>
        {!locked && (
          <SearchableSelect
            options={availableApplications.map((a) => ({
              value: a.id,
              label: a.full_name || a.user_nuid,
            }))}
            onValueChange={(applicationId) =>
              upsertEntry.mutate({ listId: list.id, applicationId })
            }
            placeholder="Add an applicant…"
            searchPlaceholder="Search applicants…"
            emptyText="No matching applicants."
            className="w-72"
            ariaLabel="Add an applicant"
          />
        )}
      </div>
    </PageContainer>
  )
}

function EntryRow({
  entry,
  index,
  total,
  locked,
  onMove,
  onRemove,
  onSaveReasoning,
}: {
  entry: {
    id: string
    application_id: string
    full_name: string
    email: string
    reasoning?: string
  }
  index: number
  total: number
  locked: boolean
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
  onSaveReasoning: (reasoning: string) => void
}) {
  const [reasoning, setReasoning] = useState(entry.reasoning ?? '')

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 sm:flex-row sm:items-start">
      <div className="flex shrink-0 flex-col items-center gap-1 sm:w-8">
        <span className="text-text-subtle text-sm font-semibold">
          {index + 1}
        </span>
        {!locked && (
          <div className="flex flex-row gap-1 sm:flex-col">
            <button
              type="button"
              onClick={() => onMove(-1)}
              disabled={index === 0}
              aria-label="Move up"
              className="text-text-faint hover:text-text-muted disabled:opacity-30"
            >
              <ArrowUp size={14} />
            </button>
            <button
              type="button"
              onClick={() => onMove(1)}
              disabled={index === total - 1}
              aria-label="Move down"
              className="text-text-faint hover:text-text-muted disabled:opacity-30"
            >
              <ArrowDown size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-text-default text-sm font-medium">
              {entry.full_name}
            </p>
            <p className="text-text-subtle text-xs">{entry.email}</p>
          </div>
          {!locked && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove ${entry.full_name}`}
              className="text-text-faint hover:text-text-muted shrink-0"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <Label className="sr-only" htmlFor={`reasoning-${entry.id}`}>
          Reasoning
        </Label>
        <textarea
          id={`reasoning-${entry.id}`}
          value={reasoning}
          onChange={(e) => setReasoning(e.target.value)}
          onBlur={() => {
            if (reasoning !== (entry.reasoning ?? ''))
              onSaveReasoning(reasoning)
          }}
          disabled={locked}
          placeholder="Reasoning (optional)…"
          rows={2}
          className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>
    </div>
  )
}
