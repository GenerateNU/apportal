'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  LayoutGrid,
  Loader2,
  Lock,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react'
import { PageContainer } from '@/components/PageContainer'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  availabilityOptionsFor,
  findAvailabilityQuestionId,
  MEETING_DAY_LABEL,
} from '@/app/(portal)/reviewer/applications/components/meetingAvailability'
import { APIError } from '@/lib/api/client'
import type {
  ApplicationSummary,
  MeetingDay,
  PreferenceListStatus,
  Role,
} from '@/lib/api/types'
import { useAnswersByApplicationIdBatches } from '@/lib/queries/answers'
import { useApplications } from '@/lib/queries/applications'
import { useDraftedApplications } from '@/lib/queries/drafts'
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
import {
  useChiefs,
  useCurrentUser,
  useLeads,
  useReviewerNames,
} from '@/lib/queries/users'
import { useQuestionsByCycleRoles } from '@/lib/queries/questions'
import { ROLE_CHIP_CLASS, ROLE_COLUMNS, ROLE_LABEL } from '@/lib/roles'
import { usePersistedFilters } from '@/hooks/usePersistedFilters'
import type {
  AnswerFilter,
  FilterChangeHandler,
} from '@/app/(portal)/reviewer/applications/components/FilterButton'
import { FilterChips } from '@/app/(portal)/reviewer/applications/components/FilterButton'
import { useApplicationFilters } from '@/app/(portal)/reviewer/applications/components/useApplicationFilters'
import { CommentThread } from './CommentThread'
import type { PreferenceEntry } from './EntryRow'
import { GroupSettings } from './GroupSettings'
import { RankedList } from './RankedList'
import { ReferencePane } from './ReferencePane'

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

// Coarse on purpose: the sticky header wants "is this urgent", not a clock.
function deadlineLabel(closesAt: string | undefined): string | null {
  if (!closesAt) return null
  const remaining = new Date(closesAt).getTime() - Date.now()
  if (remaining <= 0) return 'Closed'
  const days = Math.floor(remaining / 86_400_000)
  if (days >= 1) return `Closes in ${days}d`
  const hours = Math.floor(remaining / 3_600_000)
  if (hours >= 1) return `Closes in ${hours}h`
  return `Closes in ${Math.max(1, Math.floor(remaining / 60_000))}m`
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
  const nameByNuid = useReviewerNames()

  // Which list is being edited ('group' or a personal owner's nuid), and
  // which one — if any — is shown beside it for reference.
  const [viewMode, setViewMode] = useState('group')
  const [compareWith, setCompareWith] = useState('none')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [roleTab, setRoleTab] = useState<Role>(ROLE_COLUMNS[0])
  const [filters, setFilters] = useState<AnswerFilter[]>([])

  // Role is a filter chip like everything else. Entries and their ranks are
  // still per-role, so the applicants card ranks one role at a time.
  const { roles, columns, hasAvailability, filterParams } =
    useApplicationFilters({
      cycleId: list?.cycle_id ?? '',
      defaultRoles: ROLE_COLUMNS,
      filters,
      setFilters,
    })

  // The same chips the applications table uses, narrowing the candidates
  // offered in the add-applicant pickers below — applied in SQL, not here.
  const { data: applications = [] } = useApplications(
    list ? { cycle_id: list.cycle_id, ...filterParams } : undefined,
    undefined,
    { enabled: !!list }
  )

  // Per list, so a filter set built while drafting one group doesn't follow
  // you into another. Versioned like the applications table's own key.
  const filterSnapshot = useMemo(() => ({ filters }), [filters])
  const restoreFilters = useCallback((stored: { filters?: AnswerFilter[] }) => {
    if (Array.isArray(stored.filters)) setFilters(stored.filters)
  }, [])
  usePersistedFilters(
    `preference-list-${id}-filters-v1`,
    filterSnapshot,
    restoreFilters
  )

  const handleFilterChange: FilterChangeHandler = (filter, action) => {
    if (!filter) return
    setFilters((prev) =>
      action === 'remove'
        ? prev.filter((f) => f.question_id !== filter.question_id)
        : action === 'update'
          ? prev.map((f) => (f.question_id === filter.question_id ? filter : f))
          : [...prev, filter]
    )
  }

  // Already claimed on a draft board — shown as a marker on the entry rather
  // than removed from the list, so undoing a pick needs no repair here.
  const { data: draftedByApplicationId = {} } = useDraftedApplications(
    list?.cycle_id ?? '',
    { poll: true }
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
  const closesAtByRole = Object.fromEntries(
    ROLE_COLUMNS.map((r) => [r, deadlineQueryByRole[r].data?.closes_at])
  ) as Record<Role, string | undefined>
  const lockedByRole = Object.fromEntries(
    ROLE_COLUMNS.map((r) => [r, deadlinePassed(closesAtByRole[r])])
  ) as Record<Role, boolean>
  const groupLocked = ROLE_COLUMNS.every((r) => lockedByRole[r])

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

  // Resyncs from the poll while the field isn't being edited, so a
  // teammate's concurrent rename shows up locally — but never overwrites the
  // name mid-edit. Adjusted during render (React's documented pattern for
  // "reset state when a prop changes") rather than in an effect.
  const [name, setName] = useState('')
  const [prevListName, setPrevListName] = useState<string | undefined>(
    undefined
  )
  if (list && list.name !== prevListName) {
    setPrevListName(list.name)
    if (!editingName) setName(list.name)
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

  const meetingDay = list.meeting_day
  const activeRole = roles.includes(roleTab) ? roleTab : roles[0]

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
  const groupComments = list.comments.filter((c) => !c.application_id)
  function commentsForEntry(applicationId: string) {
    return list!.comments.filter((c) => c.application_id === applicationId)
  }

  const byName = (a: ApplicationSummary, b: ApplicationSummary) =>
    (a.full_name || a.user_nuid).localeCompare(b.full_name || b.user_nuid)

  // 'group' reads the shared ranking; anything else is that owner's personal
  // one. Both shapes carry the fields EntryRow renders.
  function entriesForView(mode: string, role: Role): PreferenceEntry[] {
    return mode === 'group'
      ? list!.entries.filter((e) => e.application_role === role)
      : list!.personal_entries.filter(
          (e) => e.owner_nuid === mode && e.application_role === role
        )
  }

  // The pool spans every role, so each tab offers only its own — adding
  // someone under the wrong heading would file them under their real role
  // anyway, where you weren't looking.
  function candidatesFor(role: Role, taken: Set<string>) {
    return applications
      .filter((a) => a.role === role && !taken.has(a.id))
      .sort(byName)
  }

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

  function listLabel(mode: string) {
    if (mode === 'group') return 'Group list'
    if (mode === currentUser?.nuid) return 'My list'
    return `${nameByNuid.get(mode) ?? mode}'s list`
  }

  const editingGroup = viewMode === 'group'
  const isViewingMine = !editingGroup && viewMode === currentUser?.nuid
  const editLocked = editingGroup ? lockedByRole[activeRole] : !isViewingMine

  const entries = entriesForView(viewMode, activeRole)
  const takenIds = new Set(entries.map((e) => e.application_id))

  function saveName() {
    setEditingName(false)
    const trimmed = name.trim()
    if (!trimmed || trimmed === list!.name) {
      setName(list!.name)
      return
    }
    updateList.mutate({
      id: list!.id,
      cycleId: list!.cycle_id,
      body: { name: trimmed },
    })
  }

  function toggleSubmitted() {
    updateList.mutate({
      id: list!.id,
      cycleId: list!.cycle_id,
      body: { status: list!.status === 'submitted' ? 'draft' : 'submitted' },
    })
  }

  function addEntry(applicationId: string) {
    const vars = { listId: list!.id, applicationId }
    if (editingGroup) upsertEntry.mutate(vars)
    else upsertPersonalEntry.mutate(vars)
  }

  function removeEntry(applicationId: string) {
    const vars = { listId: list!.id, applicationId }
    if (editingGroup) deleteEntry.mutate(vars)
    else deletePersonalEntry.mutate(vars)
  }

  function reorder(applicationIds: string[]) {
    const vars = { listId: list!.id, applicationIds }
    if (editingGroup) reorderEntries.mutate(vars)
    else reorderPersonalEntries.mutate(vars)
  }

  function saveReasoning(applicationId: string, reasoning: string) {
    const vars = { listId: list!.id, applicationId, reasoning }
    if (editingGroup) upsertEntry.mutate(vars)
    else upsertPersonalEntry.mutate(vars)
  }

  const countdown = deadlineLabel(closesAtByRole[activeRole])

  return (
    <PageContainer>
      <Link
        href="/reviewer/preference-lists"
        className="text-text-muted hover:text-text-default inline-flex w-fit items-center gap-1 text-sm"
      >
        <ArrowLeft size={14} />
        Back to preference lists
      </Link>

      {/* Sticky: on a long ranking you otherwise lose the list's name, its
          status and how long is left the moment you start scrolling. */}
      <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 sm:-mx-8 sm:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {editingName ? (
            <Input
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveName()
                if (e.key === 'Escape') {
                  setName(list.name)
                  setEditingName(false)
                }
              }}
              aria-label="Group name"
              className="max-w-sm text-lg font-semibold"
            />
          ) : (
            <button
              type="button"
              onClick={() => !groupLocked && setEditingName(true)}
              disabled={groupLocked}
              className="text-text-default group inline-flex min-w-0 items-center gap-1.5 text-lg font-semibold"
            >
              <span className="truncate">{list.name}</span>
              {!groupLocked && (
                <Pencil
                  size={13}
                  className="text-text-faint shrink-0 opacity-0 group-hover:opacity-100"
                />
              )}
            </button>
          )}
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
          {countdown && (
            <span className="text-text-subtle shrink-0 text-xs">
              {countdown}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Cross-group comparison lives on its own board — the panes below
              only reach the lists inside this group. */}
          <Link
            href={`/reviewer/preference-lists/overview?cycle=${list.cycle_id}`}
            className="text-brand-blue inline-flex items-center gap-1.5 text-sm hover:underline"
          >
            <LayoutGrid size={14} />
            Compare all groups
          </Link>
          <Button
            onClick={toggleSubmitted}
            variant={list.status === 'submitted' ? 'outline' : 'default'}
            disabled={groupLocked || updateList.isPending}
          >
            {list.status === 'submitted' ? 'Mark as draft' : 'Submit'}
          </Button>
          {isChief && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" aria-label="More actions">
                  <MoreHorizontal size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => setConfirmingDelete(true)}
                >
                  <Trash2 size={14} />
                  Delete group
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {groupLocked ? (
        <div className="border-border bg-muted/40 text-text-muted flex items-center gap-2 rounded-lg border px-4 py-3 text-sm">
          <Lock size={14} />
          Every role&apos;s preference list deadline for this cycle has passed.
          This group is fully read-only.
        </div>
      ) : (
        ROLE_COLUMNS.filter((r) => lockedByRole[r]).map((r) => (
          <div
            key={r}
            className="border-border bg-muted/40 text-text-muted flex items-center gap-2 rounded-lg border px-4 py-3 text-sm"
          >
            <Lock size={14} />
            The {ROLE_LABEL[r]} deadline has passed — its shared list is
            read-only. Other roles and group settings remain editable.
          </div>
        ))
      )}

      <GroupSettings
        open={settingsOpen}
        onToggle={() => setSettingsOpen((v) => !v)}
        groupLocked={groupLocked}
        isChief={isChief}
        meetingDay={meetingDay}
        onMeetingDayChange={(day) =>
          setMeetingDay.mutate({ id: list.id, meetingDay: day })
        }
        closesAtByRole={closesAtByRole}
        onSetDeadline={(role, closesAt) =>
          setDeadline.mutate({ cycleId: list.cycle_id, role, closesAt })
        }
        deadlineError={setDeadline.isError}
        members={list.members}
        nameByNuid={nameByNuid}
        availableToAdd={availableToAdd}
        maxMembers={MAX_PREFERENCE_LIST_MEMBERS}
        onAddMember={(nuid) =>
          addMember.mutate({ listId: list.id, leadNuid: nuid })
        }
        onRemoveMember={(memberId) =>
          removeMember.mutate({ listId: list.id, memberId })
        }
      />

      <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        {roles.length > 1 && (
          <div className="flex items-center gap-1 border-b border-gray-100 pb-3">
            {roles.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRoleTab(r)}
                aria-current={r === activeRole}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium ${
                  r === activeRole
                    ? 'bg-muted text-text-default'
                    : 'text-text-muted hover:text-text-default'
                }`}
              >
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] ${ROLE_CHIP_CLASS[r]}`}
                >
                  {ROLE_LABEL[r]}
                </span>
                <span className="text-text-faint text-xs">
                  {entriesForView(viewMode, r).length}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-text-muted text-sm">Editing</span>
          <Select value={viewMode} onValueChange={setViewMode}>
            <SelectTrigger className="w-44" aria-label="Which list to edit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="group">Group list</SelectItem>
              {personalOwnerNuids.map((nuid) => (
                <SelectItem key={nuid} value={nuid}>
                  {listLabel(nuid)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-text-muted text-sm">beside</span>
          <Select value={compareWith} onValueChange={setCompareWith}>
            <SelectTrigger className="w-44" aria-label="Which list to compare">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nothing</SelectItem>
              {['group', ...personalOwnerNuids]
                .filter((mode) => mode !== viewMode)
                .map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {listLabel(mode)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-4">
          <FilterChips
            filters={filters}
            columns={columns}
            onFilterChange={handleFilterChange}
            hasAvailability={hasAvailability}
          />
        </div>

        <div
          className={
            compareWith === 'none' ? undefined : 'grid gap-6 lg:grid-cols-2'
          }
        >
          <RankedList
            role={activeRole}
            entries={entries}
            candidates={candidatesFor(activeRole, takenIds)}
            locked={editLocked}
            emptyText={
              editingGroup
                ? 'No applicants on this list yet.'
                : isViewingMine
                  ? "You haven't added anyone to your personal list yet."
                  : "This person hasn't added anyone to their personal list yet."
            }
            meetingDay={meetingDay}
            availabilityBadgeFor={availabilityBadgeFor}
            draftedByApplicationId={draftedByApplicationId}
            onOpenSettings={() => setSettingsOpen(true)}
            onAdd={addEntry}
            onReorder={reorder}
            onRemove={removeEntry}
            onSaveReasoning={saveReasoning}
            commentsFor={editingGroup ? commentsForEntry : undefined}
            currentUserNuid={currentUser?.nuid}
            onAddComment={(applicationId, body) =>
              createComment.mutate({ listId: list.id, applicationId, body })
            }
            onEditComment={(commentId, body) =>
              updateComment.mutate({ listId: list.id, commentId, body })
            }
            isAddingComment={createComment.isPending}
            isEditingComment={updateComment.isPending}
          />

          {compareWith !== 'none' && (
            <ReferencePane
              title={listLabel(compareWith)}
              role={activeRole}
              entries={entriesForView(compareWith, activeRole)}
              presentIds={takenIds}
              canAdd={!editLocked}
              onAdd={addEntry}
              availabilityBadgeFor={availabilityBadgeFor}
              draftedByApplicationId={draftedByApplicationId}
              emptyText="Nothing on this list yet."
            />
          )}
        </div>
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

      <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this group?</DialogTitle>
            <DialogDescription>
              {list.name} and its ranked applicants, personal lists and comments
              are deleted for everyone. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmingDelete(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteList.isPending}
              onClick={() =>
                deleteList.mutate({ id: list.id, cycleId: list.cycle_id })
              }
            >
              {deleteList.isPending ? (
                <>
                  <Loader2 className="animate-spin" size={14} />
                  Deleting…
                </>
              ) : (
                'Delete group'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
