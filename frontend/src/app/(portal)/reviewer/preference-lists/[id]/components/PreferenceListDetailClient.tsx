'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Loader2,
  Lock,
  Pencil,
  Trash2,
  X,
} from 'lucide-react'
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
  availabilityOptionsFor,
  findAvailabilityQuestionId,
  MEETING_DAY_LABEL,
} from '@/app/(portal)/reviewer/applications/components/meetingAvailability'
import { APIError } from '@/lib/api/client'
import type {
  MeetingDay,
  PreferenceListComment,
  PreferenceListStatus,
  Role,
} from '@/lib/api/types'
import { useAnswersByApplicationIdBatches } from '@/lib/queries/answers'
import { useApplications } from '@/lib/queries/applications'
import {
  useAddPreferenceListMember,
  useCreatePreferenceListComment,
  useDeletePersonalPreferenceListEntry,
  useDeletePreferenceList,
  useDeletePreferenceListEntry,
  usePreferenceList,
  usePreferenceListDeadline,
  useRemovePreferenceListMember,
  useReorderPersonalPreferenceListEntries,
  useReorderPreferenceListEntries,
  useSetPreferenceListDeadline,
  useSetPreferenceListMeetingDay,
  useUpdatePreferenceList,
  useUpdatePreferenceListComment,
  useUpsertPersonalPreferenceListEntry,
  useUpsertPreferenceListEntry,
} from '@/lib/queries/preference-lists'
import { useQuestionsByCycleRoles } from '@/lib/queries/questions'
import { useChiefs, useCurrentUser, useLeads } from '@/lib/queries/users'
import { ROLE_CHIP_CLASS, ROLE_COLUMNS, ROLE_LABEL } from '@/lib/roles'

// True/false once we know; null when the applicant left no usable answer at
// all (no answer to the availability question, or it predates it).
function isAvailableOn(
  options: string[] | null | undefined,
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

// Matches the backend's maxPreferenceListMembers — enforced there, mirrored
// here just to hide the picker before a rejected request round-trips.
const MAX_PREFERENCE_LIST_MEMBERS = 4

function deadlinePassed(closesAt: string | undefined | null): boolean {
  return !!closesAt && new Date(closesAt) < new Date()
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
  const { data: currentUser } = useCurrentUser()

  const nameByNuid = new Map<string, string>()
  for (const u of [...leads, ...chiefs]) nameByNuid.set(u.nuid, u.full_name)

  const [selectedRole, setSelectedRole] = useState<Role>(ROLE_COLUMNS[0])
  const [viewMode, setViewMode] = useState('group')

  const { data: applications = [] } = useApplications(
    list ? { cycle_id: list.cycle_id, role: selectedRole } : undefined,
    undefined,
    { enabled: !!list }
  )

  // Availability is about applicants, not leads: each applicant answers a
  // "Meeting Availability" question on their own application, and they're
  // flagged free/busy against whichever day this group has settled on,
  // scoped to their own role's copy of that question.
  const questionQueries = useQuestionsByCycleRoles(
    ROLE_COLUMNS.map((r) => ({ cycleId: list?.cycle_id ?? '', role: r }))
  )
  const availabilityQuestionIdByRole = Object.fromEntries(
    ROLE_COLUMNS.map((r, i) => [
      r,
      findAvailabilityQuestionId(questionQueries[i]?.data),
    ])
  ) as Record<Role, string | undefined>

  // Every entry's (shared and personal, any role) application ids, plus the
  // current tab's whole candidate pool (so applicants not yet added can also
  // show a badge in the add-applicant pickers) — fetched once per role tab,
  // not per row.
  const applicationIdsForAvailability = list
    ? [
        ...new Set(
          [...list.entries, ...list.personal_entries]
            .map((e) => e.application_id)
            .concat(applications.map((a) => a.id))
        ),
      ]
    : []
  const [availabilityAnswers] = useAnswersByApplicationIdBatches([
    applicationIdsForAvailability,
  ])
  const answersByApplicationId = availabilityAnswers?.data ?? {}

  // Deadlines are still per (cycle, role) — a group covers every role, so we
  // need every role's deadline to know both the current tab's lock state
  // and whether the whole group (every role) has closed.
  const engineerDeadline = usePreferenceListDeadline(
    list?.cycle_id ?? '',
    'software_engineer'
  )
  const designerDeadline = usePreferenceListDeadline(
    list?.cycle_id ?? '',
    'software_designer'
  )
  const deadlineQueryByRole: Record<Role, typeof engineerDeadline> = {
    software_engineer: engineerDeadline,
    software_designer: designerDeadline,
  }
  const selectedDeadline = deadlineQueryByRole[selectedRole].data
  const entryLocked = deadlinePassed(selectedDeadline?.closes_at)
  const groupLocked = ROLE_COLUMNS.every((r) =>
    deadlinePassed(deadlineQueryByRole[r].data?.closes_at)
  )

  const updateList = useUpdatePreferenceList()
  const deleteList = useDeletePreferenceList()
  const addMember = useAddPreferenceListMember()
  const removeMember = useRemovePreferenceListMember()
  const upsertEntry = useUpsertPreferenceListEntry()
  const deleteEntry = useDeletePreferenceListEntry()
  const reorderEntries = useReorderPreferenceListEntries()
  const upsertPersonalEntry = useUpsertPersonalPreferenceListEntry()
  const deletePersonalEntry = useDeletePersonalPreferenceListEntry()
  const reorderPersonalEntries = useReorderPersonalPreferenceListEntries()
  const setDeadline = useSetPreferenceListDeadline()
  const setMeetingDay = useSetPreferenceListMeetingDay()
  const createComment = useCreatePreferenceListComment()
  const updateComment = useUpdatePreferenceListComment()

  // Resyncs from the poll while the field isn't focused, so a teammate's
  // concurrent rename shows up locally — but never overwrites the name
  // mid-edit, only once you're not actively typing in it. Adjusted during
  // render (React's documented pattern for "reset state when a prop
  // changes") rather than in an effect, to avoid an extra render pass.
  const [name, setName] = useState('')
  const [nameFocused, setNameFocused] = useState(false)
  const [prevListName, setPrevListName] = useState<string | undefined>(
    undefined
  )
  if (list && list.name !== prevListName) {
    setPrevListName(list.name)
    if (!nameFocused) setName(list.name)
  }

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
  const atMemberCap = list.members.length >= MAX_PREFERENCE_LIST_MEMBERS

  const meetingDay = list.meeting_day

  function availabilityBadgeFor(applicationId: string, role: Role) {
    if (!meetingDay) return undefined
    const options = availabilityOptionsFor(
      answersByApplicationId[applicationId],
      availabilityQuestionIdByRole[role]
    )
    return availabilityBadge(isAvailableOn(options, meetingDay))
  }

  // Comments are scoped to the shared list only, not personal lists.
  // application_id absent is a comment on the group as a whole.
  const comments = list.comments
  const groupComments = comments.filter((c) => !c.application_id)
  function commentsForEntry(applicationId: string) {
    return comments.filter((c) => c.application_id === applicationId)
  }

  const roleEntries = list.entries.filter(
    (e) => e.application_role === selectedRole
  )
  const entryApplicationIds = new Set(roleEntries.map((e) => e.application_id))
  const availableApplications = applications
    .filter((a) => !entryApplicationIds.has(a.id))
    .sort((a, b) =>
      (a.full_name || a.user_nuid).localeCompare(b.full_name || b.user_nuid)
    )

  // Whose personal list can be viewed: every current member, plus anyone
  // who's already added personal entries (covers a chief/admin who has
  // access without literally being a member), plus the current user
  // themself so "My list" always shows even before they've added anything.
  const personalOwnerNuids = [
    ...new Set([
      ...list.members.map((m) => m.lead_nuid),
      ...list.personal_entries.map((e) => e.owner_nuid),
      ...(currentUser ? [currentUser.nuid] : []),
    ]),
  ].sort((a, b) => {
    if (a === currentUser?.nuid) return -1
    if (b === currentUser?.nuid) return 1
    return (nameByNuid.get(a) ?? a).localeCompare(nameByNuid.get(b) ?? b)
  })

  const viewingOwnerNuid = viewMode === 'group' ? null : viewMode
  const isViewingMine =
    viewingOwnerNuid !== null && viewingOwnerNuid === currentUser?.nuid
  const personalEntriesForView = viewingOwnerNuid
    ? list.personal_entries.filter(
        (e) =>
          e.owner_nuid === viewingOwnerNuid &&
          e.application_role === selectedRole
      )
    : []
  const personalEntryApplicationIds = new Set(
    personalEntriesForView.map((e) => e.application_id)
  )
  const availablePersonalApplications = applications
    .filter((a) => !personalEntryApplicationIds.has(a.id))
    .sort((a, b) =>
      (a.full_name || a.user_nuid).localeCompare(b.full_name || b.user_nuid)
    )

  function saveName() {
    const trimmed = name.trim()
    if (!list || !trimmed || trimmed === list.name) return
    updateList.mutate({
      id: list.id,
      cycleId: list.cycle_id,
      body: { name: trimmed },
    })
  }

  function toggleSubmitted() {
    if (!list) return
    updateList.mutate({
      id: list.id,
      cycleId: list.cycle_id,
      body: { status: list.status === 'submitted' ? 'draft' : 'submitted' },
    })
  }

  function moveEntry(index: number, direction: -1 | 1) {
    if (!list) return
    const target = index + direction
    if (target < 0 || target >= roleEntries.length) return
    const ids = roleEntries.map((e) => e.application_id)
    const [moved] = ids.splice(index, 1)
    ids.splice(target, 0, moved)
    reorderEntries.mutate({ listId: list.id, applicationIds: ids })
  }

  function movePersonalEntry(index: number, direction: -1 | 1) {
    if (!list) return
    const target = index + direction
    if (target < 0 || target >= personalEntriesForView.length) return
    const ids = personalEntriesForView.map((e) => e.application_id)
    const [moved] = ids.splice(index, 1)
    ids.splice(target, 0, moved)
    reorderPersonalEntries.mutate({ listId: list.id, applicationIds: ids })
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

      {groupLocked ? (
        <div className="border-border bg-muted/40 text-text-muted flex items-center gap-2 rounded-lg border px-4 py-3 text-sm">
          <Lock size={14} />
          Every role&apos;s preference list deadline for this cycle has passed.
          This group is fully read-only.
        </div>
      ) : (
        entryLocked && (
          <div className="border-border bg-muted/40 text-text-muted flex items-center gap-2 rounded-lg border px-4 py-3 text-sm">
            <Lock size={14} />
            The {ROLE_LABEL[selectedRole]} deadline has passed — its shared list
            is read-only. Other roles and group settings remain editable.
          </div>
        )
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={() => setNameFocused(true)}
            onBlur={() => {
              setNameFocused(false)
              saveName()
            }}
            disabled={groupLocked}
            className="max-w-sm text-lg font-semibold"
          />
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
            disabled={groupLocked || updateList.isPending}
          >
            {list.status === 'submitted' ? 'Mark as draft' : 'Submit'}
          </Button>
          {isChief && (
            <Button
              variant="outline"
              onClick={() =>
                deleteList.mutate({ id: list.id, cycleId: list.cycle_id })
              }
              disabled={deleteList.isPending}
            >
              <Trash2 data-icon="inline-start" size={14} />
              Delete group
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
        {ROLE_COLUMNS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setSelectedRole(r)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              selectedRole === r
                ? ROLE_CHIP_CLASS[r]
                : 'text-text-faint hover:text-text-muted'
            }`}
          >
            {ROLE_LABEL[r]}
          </button>
        ))}
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
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm">
          <span className="text-text-muted font-medium">
            Deadline for every {ROLE_LABEL[selectedRole]} list this cycle:
          </span>
          <DateTimePicker
            value={
              selectedDeadline?.closes_at
                ? new Date(selectedDeadline.closes_at)
                : undefined
            }
            onValueChange={(date) =>
              setDeadline.mutate({
                cycleId: list.cycle_id,
                role: selectedRole,
                closesAt: date.toISOString(),
              })
            }
            placeholder="No deadline set"
          />
          {selectedDeadline?.closes_at && (
            <button
              type="button"
              onClick={() =>
                setDeadline.mutate({
                  cycleId: list.cycle_id,
                  role: selectedRole,
                  closesAt: null,
                })
              }
              className="text-text-faint hover:text-text-muted inline-flex items-center gap-1 text-xs"
            >
              <X size={12} />
              Clear
            </button>
          )}
          {setDeadline.isError && (
            <span className="text-xs text-red-600">
              Couldn&apos;t save the deadline — try again.
            </span>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-text-faint text-xs font-semibold tracking-wide uppercase">
          Members ({list.members.length}/{MAX_PREFERENCE_LIST_MEMBERS})
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {list.members.map((m) => (
            <span
              key={m.id}
              className="bg-muted inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm"
            >
              {nameByNuid.get(m.lead_nuid) ?? m.lead_nuid}
              {!groupLocked && (
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
          ))}
        </div>
        {!groupLocked && !atMemberCap && (
          <SearchableSelect
            options={availableToAdd.map((u) => ({
              value: u.nuid,
              label: u.full_name,
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
        {!groupLocked && atMemberCap && (
          <p className="text-text-faint text-xs">
            This group has reached the maximum of {MAX_PREFERENCE_LIST_MEMBERS}{' '}
            members.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-text-faint text-xs font-semibold tracking-wide uppercase">
            Applicants — {ROLE_LABEL[selectedRole]}
          </h2>
          <Select value={viewMode} onValueChange={setViewMode}>
            <SelectTrigger className="w-48" aria-label="Viewing which list">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="group">Group list</SelectItem>
              {personalOwnerNuids.map((nuid) => (
                <SelectItem key={nuid} value={nuid}>
                  {nuid === currentUser?.nuid
                    ? 'My list'
                    : `${nameByNuid.get(nuid) ?? nuid}'s list`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {viewMode === 'group' ? (
          <>
            <div className="flex flex-col gap-2">
              {roleEntries.map((entry, index) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  availabilityBadge={availabilityBadgeFor(
                    entry.application_id,
                    entry.application_role
                  )}
                  index={index}
                  total={roleEntries.length}
                  locked={entryLocked}
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
                  comments={commentsForEntry(entry.application_id)}
                  currentUserNuid={currentUser?.nuid}
                  onAddComment={(body) =>
                    createComment.mutate({
                      listId: list.id,
                      applicationId: entry.application_id,
                      body,
                    })
                  }
                  onEditComment={(commentId, body) =>
                    updateComment.mutate({ listId: list.id, commentId, body })
                  }
                  isAddingComment={createComment.isPending}
                  isEditingComment={updateComment.isPending}
                />
              ))}
              {roleEntries.length === 0 && (
                <p className="text-text-faint text-sm">
                  No applicants on this list yet.
                </p>
              )}
            </div>
            {!entryLocked && (
              <SearchableSelect
                options={availableApplications.map((a) => ({
                  value: a.id,
                  label: a.full_name || a.user_nuid,
                  badge: availabilityBadgeFor(a.id, selectedRole),
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
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              {personalEntriesForView.map((entry, index) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  availabilityBadge={availabilityBadgeFor(
                    entry.application_id,
                    entry.application_role
                  )}
                  index={index}
                  total={personalEntriesForView.length}
                  locked={!isViewingMine}
                  onMove={(direction) => movePersonalEntry(index, direction)}
                  onRemove={() =>
                    deletePersonalEntry.mutate({
                      listId: list.id,
                      applicationId: entry.application_id,
                    })
                  }
                  onSaveReasoning={(reasoning) =>
                    upsertPersonalEntry.mutate({
                      listId: list.id,
                      applicationId: entry.application_id,
                      reasoning,
                    })
                  }
                />
              ))}
              {personalEntriesForView.length === 0 && (
                <p className="text-text-faint text-sm">
                  {isViewingMine
                    ? "You haven't added anyone to your personal list yet."
                    : "This person hasn't added anyone to their personal list yet."}
                </p>
              )}
            </div>
            {isViewingMine && (
              <SearchableSelect
                options={availablePersonalApplications.map((a) => ({
                  value: a.id,
                  label: a.full_name || a.user_nuid,
                  badge: availabilityBadgeFor(a.id, selectedRole),
                }))}
                onValueChange={(applicationId) =>
                  upsertPersonalEntry.mutate({ listId: list.id, applicationId })
                }
                placeholder="Add an applicant…"
                searchPlaceholder="Search applicants…"
                emptyText="No matching applicants."
                className="w-72"
                ariaLabel="Add an applicant to your personal list"
              />
            )}
          </>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-text-faint text-xs font-semibold tracking-wide uppercase">
          Group comments
        </h2>
        <CommentThread
          comments={groupComments}
          currentUserNuid={currentUser?.nuid}
          onAdd={(body) => createComment.mutate({ listId: list.id, body })}
          onEdit={(commentId, body) =>
            updateComment.mutate({ listId: list.id, commentId, body })
          }
          isAdding={createComment.isPending}
          isEditing={updateComment.isPending}
          placeholder="Add a comment on this group…"
        />
      </div>
    </PageContainer>
  )
}

function EntryRow({
  entry,
  availabilityBadge,
  index,
  total,
  locked,
  onMove,
  onRemove,
  onSaveReasoning,
  comments,
  currentUserNuid,
  onAddComment,
  onEditComment,
  isAddingComment,
  isEditingComment,
}: {
  entry: {
    id: string
    application_id: string
    full_name: string
    email: string
    reasoning?: string
  }
  availabilityBadge?: { label: string; className: string }
  index: number
  total: number
  locked: boolean
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
  onSaveReasoning: (reasoning: string) => void
  // Comments are only offered for shared-list entries, not personal ones —
  // omit these props entirely to hide the collapsible thread.
  comments?: PreferenceListComment[]
  currentUserNuid?: string
  onAddComment?: (body: string) => void
  onEditComment?: (commentId: string, body: string) => void
  isAddingComment?: boolean
  isEditingComment?: boolean
}) {
  // Same resync-when-unfocused treatment as the group name above (adjusted
  // during render, not in an effect), so a teammate's concurrent reasoning
  // edit — picked up by the 8s poll — shows here instead of being
  // permanently masked by this row's own local state.
  const [reasoning, setReasoning] = useState(entry.reasoning ?? '')
  const [reasoningFocused, setReasoningFocused] = useState(false)
  const [prevReasoning, setPrevReasoning] = useState(entry.reasoning)
  if (entry.reasoning !== prevReasoning) {
    setPrevReasoning(entry.reasoning)
    if (!reasoningFocused) setReasoning(entry.reasoning ?? '')
  }
  const [commentsOpen, setCommentsOpen] = useState(false)

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
            <div className="flex items-center gap-1.5">
              <p className="text-text-default text-sm font-medium">
                {entry.full_name}
              </p>
              {availabilityBadge && (
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${availabilityBadge.className}`}
                >
                  {availabilityBadge.label}
                </span>
              )}
            </div>
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
          onFocus={() => setReasoningFocused(true)}
          onBlur={() => {
            setReasoningFocused(false)
            if (reasoning !== (entry.reasoning ?? ''))
              onSaveReasoning(reasoning)
          }}
          disabled={locked}
          placeholder="Reasoning (optional)…"
          rows={2}
          className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-60"
        />
        {comments && (
          <div className="border-t border-gray-100 pt-2">
            <button
              type="button"
              onClick={() => setCommentsOpen((v) => !v)}
              className="text-brand-blue inline-flex items-center gap-1 text-xs hover:underline"
            >
              {commentsOpen ? (
                <ChevronUp size={12} />
              ) : (
                <ChevronDown size={12} />
              )}
              Comments ({comments.length})
            </button>
            {commentsOpen && (
              <div className="mt-2">
                <CommentThread
                  comments={comments}
                  currentUserNuid={currentUserNuid}
                  onAdd={(body) => onAddComment?.(body)}
                  onEdit={(commentId, body) => onEditComment?.(commentId, body)}
                  isAdding={!!isAddingComment}
                  isEditing={!!isEditingComment}
                  placeholder="Add a comment on this applicant…"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function CommentThread({
  comments,
  currentUserNuid,
  onAdd,
  onEdit,
  isAdding,
  isEditing,
  placeholder,
}: {
  comments: PreferenceListComment[]
  currentUserNuid?: string
  onAdd: (body: string) => void
  onEdit: (commentId: string, body: string) => void
  isAdding: boolean
  isEditing: boolean
  placeholder: string
}) {
  const [newComment, setNewComment] = useState('')
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingBody, setEditingBody] = useState('')

  function startEditing(comment: PreferenceListComment) {
    setEditingCommentId(comment.id)
    setEditingBody(comment.body)
  }

  function saveEdit() {
    const body = editingBody.trim()
    if (!editingCommentId || !body) return
    onEdit(editingCommentId, body)
    setEditingCommentId(null)
  }

  function postComment() {
    const body = newComment.trim()
    if (!body) return
    onAdd(body)
    setNewComment('')
  }

  return (
    <div className="flex flex-col gap-3">
      {comments.map((c) => {
        const editing = editingCommentId === c.id
        const edited = c.updated_at !== c.created_at
        const isOwn = c.author_nuid === currentUserNuid
        return (
          <div
            key={c.id}
            className="rounded-xl border border-gray-100 bg-white p-4"
          >
            {editing ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={editingBody}
                  onChange={(e) => setEditingBody(e.target.value)}
                  rows={3}
                  autoFocus
                  aria-label="Edit comment"
                  className="focus:border-brand-blue text-text-default placeholder:text-text-subtle w-full rounded-md border border-gray-200 p-3 text-sm focus:outline-none"
                />
                <div className="flex items-center gap-2">
                  <Button
                    onClick={saveEdit}
                    disabled={isEditing || !editingBody.trim()}
                  >
                    Save
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setEditingCommentId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-text-muted text-xs">
                    {c.author_name || c.author_nuid}
                  </p>
                  <p className="text-text-default mt-1 text-sm whitespace-pre-wrap">
                    {c.body}
                  </p>
                  <p className="text-text-faint mt-1.5 text-xs">
                    {new Date(c.created_at).toLocaleString()}
                    {edited && ' · edited'}
                  </p>
                </div>
                {isOwn && (
                  <button
                    type="button"
                    onClick={() => startEditing(c)}
                    className="text-text-faint hover:text-text-muted shrink-0"
                    aria-label="Edit comment"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}

      <div className="rounded-xl border border-gray-100 bg-white p-4">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="focus:border-brand-blue text-text-default placeholder:text-text-subtle w-full rounded-md border border-gray-200 p-3 text-sm focus:outline-none"
        />
        <div className="mt-3">
          <Button
            onClick={postComment}
            disabled={isAdding || !newComment.trim()}
          >
            {isAdding ? (
              <>
                <Loader2 className="animate-spin" size={14} />
                Posting…
              </>
            ) : (
              'Post comment'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
