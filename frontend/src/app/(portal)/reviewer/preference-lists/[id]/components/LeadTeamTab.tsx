'use client'

import { TagPill } from '@/components/ui/tag-select'
import { useCycleTags } from '@/lib/queries/tags'
import type { CycleTag } from '@/lib/api/types'
import { useMemo, useState } from 'react'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical,
  Lock,
  MessageSquare,
  Plus,
  Send,
  Undo2,
  X,
} from 'lucide-react'
import { ReturnerBadge } from '@/components/ReturnerBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PanelHeading } from '@/components/ui/panel-heading'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SearchInput } from '@/components/ui/search-input'
import type {
  ApplicationSummary,
  InterviewRating,
  PreferenceListComment,
  PreferenceListDetail,
} from '@/lib/api/types'
import { RATING_LABEL } from '@/lib/interview-ratings'
import {
  useCreatePreferenceListComment,
  useDeletePersonalPreferenceListEntry,
  useDeletePreferenceListEntry,
  useReorderPersonalPreferenceListEntries,
  useReorderPreferenceListEntries,
  useUpdatePreferenceList,
  useUpdatePreferenceListComment,
  useUpsertPersonalPreferenceListEntry,
  useUpsertPreferenceListEntry,
} from '@/lib/queries/preference-lists'
import { useRoleLookup } from '@/lib/queries/roles'
import { CommentThread } from './CommentThread'
import { deadlinePassed } from './deadline'

const RATING_CHIP: Record<InterviewRating, string> = {
  must_hire: 'bg-green-50 text-green-700',
  great: 'bg-green-50 text-green-700',
  good: 'bg-gray-100 text-ink',
  neutral: 'bg-gray-100 text-text-muted',
  do_not_hire: 'bg-red-50 text-red-700',
}

export function RatingChip({ rating }: { rating?: InterviewRating }) {
  if (!rating) {
    return (
      <Badge size="sm" className="text-text-subtle bg-transparent px-0">
        Not rated
      </Badge>
    )
  }
  return (
    <Badge size="sm" className={RATING_CHIP[rating]}>
      {RATING_LABEL[rating]}
    </Badge>
  )
}

type Mode = 'team' | 'mine'

const NO_TAGS: CycleTag[] = []

type RankedEntry = {
  id: string
  application_id: string
  full_name: string
  reasoning?: string
  returner: boolean
}

export function LeadTeamTab({
  list,
  role,
  roleIds,
  pool,
  groups,
  ratings,
  closesAtByRole,
  currentUserNuid,
  initialTeamId,
  onOpenApplicant,
  roleTabs,
}: {
  list: PreferenceListDetail
  role: string
  roleIds: string[]
  pool: ApplicationSummary[]
  groups: PreferenceListDetail[]
  ratings: Record<string, InterviewRating | undefined>
  closesAtByRole: Record<string, string | undefined>
  currentUserNuid?: string
  initialTeamId?: string
  onOpenApplicant: (applicationId: string) => void
  roleTabs?: React.ReactNode
}) {
  const { roleLabel } = useRoleLookup()
  const { data: cycleTags = [] } = useCycleTags(list.cycle_id)
  const tagsByApp = useMemo(
    () =>
      new Map(
        pool.map((a) => {
          const ids = new Set(a.tag_ids ?? [])
          return [a.id, cycleTags.filter((t) => ids.has(t.id))]
        })
      ),
    [pool, cycleTags]
  )
  const tagsFor = (applicationId: string) =>
    tagsByApp.get(applicationId) ?? NO_TAGS
  const [mode, setMode] = useState<Mode>('team')
  const [viewingId, setViewingId] = useState(initialTeamId ?? list.id)
  const otherTeams = useMemo(
    () =>
      groups
        .filter((g) => g.id !== list.id)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [groups, list.id]
  )
  const viewing = otherTeams.find((g) => g.id === viewingId)
  const ourRank = useMemo(
    () =>
      new Map(
        list.entries
          .filter((e) => e.role_id === role)
          .sort((a, b) => a.rank - b.rank)
          .map((e, i) => [e.application_id, i + 1])
      ),
    [list.entries, role]
  )
  const viewingEntries = (viewing?.entries ?? [])
    .filter((e) => e.role_id === role)
    .sort((a, b) => a.rank - b.rank)
  const [query, setQuery] = useState('')

  const updateList = useUpdatePreferenceList()
  const upsertEntry = useUpsertPreferenceListEntry()
  const deleteEntry = useDeletePreferenceListEntry()
  const reorderEntries = useReorderPreferenceListEntries()
  const upsertPersonal = useUpsertPersonalPreferenceListEntry()
  const deletePersonal = useDeletePersonalPreferenceListEntry()
  const reorderPersonal = useReorderPersonalPreferenceListEntries()
  const createComment = useCreatePreferenceListComment()
  const updateComment = useUpdatePreferenceListComment()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const roleLocked = deadlinePassed(closesAtByRole[role])
  const groupLocked =
    roleIds.length > 0 &&
    roleIds.every((r) => deadlinePassed(closesAtByRole[r]))
  const isTeam = mode === 'team'
  const locked = isTeam ? roleLocked : false

  const entries: RankedEntry[] = useMemo(
    () =>
      isTeam
        ? list.entries.filter((e) => e.role_id === role)
        : list.personal_entries.filter(
            (e) => e.role_id === role && e.owner_nuid === currentUserNuid
          ),
    [isTeam, list.entries, list.personal_entries, role, currentUserNuid]
  )
  const onList = useMemo(
    () => new Set(entries.map((e) => e.application_id)),
    [entries]
  )

  const alsoOn = useMemo(() => {
    const out = new Map<string, { team: string; rank: number }[]>()
    for (const g of groups) {
      if (g.id === list.id) continue
      ;(g.entries ?? [])
        .filter((e) => e.role_id === role)
        .sort((a, b) => a.rank - b.rank)
        .forEach((e, i) => {
          const teams = out.get(e.application_id)
          const entry = { team: g.name, rank: i + 1 }
          if (teams) teams.push(entry)
          else out.set(e.application_id, [entry])
        })
    }
    return out
  }, [groups, list.id, role])

  const q = query.trim().toLowerCase()
  const unlisted = useMemo(
    () =>
      pool
        .filter((a) => !onList.has(a.id))
        .sort((a, b) =>
          (a.full_name || a.user_nuid).localeCompare(b.full_name || b.user_nuid)
        ),
    [pool, onList]
  )
  const available = q
    ? unlisted.filter((a) =>
        (a.full_name || a.user_nuid).toLowerCase().includes(q)
      )
    : unlisted
  const poolRemaining = unlisted.length

  function add(applicationId: string) {
    const vars = { listId: list.id, applicationId }
    if (isTeam) upsertEntry.mutate(vars)
    else upsertPersonal.mutate(vars)
  }

  function remove(applicationId: string) {
    const vars = { listId: list.id, applicationId }
    if (isTeam) deleteEntry.mutate(vars)
    else deletePersonal.mutate(vars)
  }

  function saveReasoning(applicationId: string, reasoning: string) {
    const vars = { listId: list.id, applicationId, reasoning }
    if (isTeam) upsertEntry.mutate(vars)
    else upsertPersonal.mutate(vars)
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const ids = entries.map((e) => e.application_id)
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from === -1 || to === -1) return
    const next = [...ids]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    const vars = { listId: list.id, applicationIds: next }
    if (isTeam) reorderEntries.mutate(vars)
    else reorderPersonal.mutate(vars)
  }

  const submitted = list.status === 'submitted'
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-gray-200 pb-4">
        {roleTabs}
        <span className="flex-1" />
        <Button
          variant={submitted ? 'brutal' : 'brutal-ink'}
          size="lg"
          className="px-4"
          disabled={groupLocked || updateList.isPending}
          onClick={() =>
            updateList.mutate({
              id: list.id,
              cycleId: list.cycle_id,
              body: { status: submitted ? 'draft' : 'submitted' },
            })
          }
        >
          {submitted ? (
            <>
              <Undo2 /> Back to draft
            </>
          ) : (
            <>
              <Send /> Submit team list
            </>
          )}
        </Button>
      </div>

      {roleLocked && (
        <p className="text-text-muted flex items-center gap-2 border border-gray-200 px-4 py-3 text-sm">
          <Lock size={14} className="shrink-0" />
          The {roleLabel(role)} deadline has passed, so the team list is
          read-only. Your own picks stay editable.
        </p>
      )}

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <section className="flex min-w-0 flex-col gap-3">
          <PanelHeading aside={`${poolRemaining} in selection`}>
            Pool
          </PanelHeading>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search applicants"
            className="sm:w-full"
          />
          {available.length === 0 ? (
            <EmptyState
              size="sm"
              title={
                q
                  ? 'No applicants match that search.'
                  : `Everyone in ${roleLabel(role)} selection is on this list.`
              }
            />
          ) : (
            <ul className="border border-gray-200 lg:max-h-[calc(100dvh-16rem)] lg:overflow-y-auto">
              {available.map((a) => {
                const others = alsoOn.get(a.id)?.length ?? 0
                return (
                  <li
                    key={a.id}
                    className="flex min-w-0 items-center gap-3 px-4 py-3 not-first:border-t not-first:border-gray-200"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenApplicant(a.id)}
                          className="text-ink min-w-0 text-left text-sm font-semibold wrap-anywhere underline-offset-2 hover:underline"
                        >
                          {a.full_name || a.user_nuid}
                        </button>
                        {a.returner && <ReturnerBadge />}
                      </div>
                      <div className="text-text-muted mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                        <RatingChip rating={ratings[a.id]} />
                        {tagsFor(a.id).map((t) => (
                          <TagPill key={t.id} tag={t} />
                        ))}
                        {others > 0 && (
                          <Badge size="sm" className="bg-red-50 text-red-700">
                            Ranked by {others} other team
                            {others === 1 ? '' : 's'}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {!locked && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => add(a.id)}
                        aria-label={`Add ${a.full_name || a.user_nuid}`}
                      >
                        <Plus />
                        Add
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="flex min-w-0 flex-col gap-3">
          <PanelHeading
            action={
              <>
                {!viewing && (
                  <button
                    type="button"
                    onClick={() => setMode(isTeam ? 'mine' : 'team')}
                    className="text-text-muted hover:text-ink text-sm underline-offset-2 hover:underline"
                  >
                    {isTeam ? 'Open my picks' : 'Back to team list'}
                  </button>
                )}
                {otherTeams.length > 0 && (
                  <Select value={viewingId} onValueChange={setViewingId}>
                    <SelectTrigger
                      aria-label="Whose ranking to show"
                      className="h-8 w-44 text-xs font-normal"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="end">
                      <SelectItem value={list.id}>
                        {list.name} (yours)
                      </SelectItem>
                      {otherTeams.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </>
            }
          >
            {viewing ? viewing.name : isTeam ? 'Our ranking' : 'My picks'}
          </PanelHeading>
          {viewing ? (
            viewingEntries.length === 0 ? (
              <EmptyState
                size="sm"
                title={`${viewing.name} hasn't ranked anyone for ${roleLabel(role)} yet.`}
              />
            ) : (
              <ol className="border border-gray-200 lg:max-h-[calc(100dvh-16rem)] lg:overflow-y-auto">
                {viewingEntries.map((e, i) => (
                  <li
                    key={e.id}
                    className="flex min-w-0 items-start gap-3 px-4 py-3 not-first:border-t not-first:border-gray-200"
                  >
                    <span className="font-display text-ink w-6 shrink-0 pt-0.5 text-center text-sm font-bold">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onOpenApplicant(e.application_id)}
                        className="text-ink min-w-0 text-left text-sm font-semibold wrap-anywhere underline-offset-2 hover:underline"
                      >
                        {e.full_name}
                      </button>
                      <div className="text-text-muted mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                        <RatingChip rating={ratings[e.application_id]} />
                        {tagsFor(e.application_id).map((t) => (
                          <TagPill key={t.id} tag={t} />
                        ))}
                        {ourRank.has(e.application_id) && (
                          <Badge size="sm" className="bg-ink text-white">
                            #{ourRank.get(e.application_id)} on yours
                          </Badge>
                        )}
                      </div>
                      {e.reasoning && (
                        <p className="text-text-muted mt-1 text-sm wrap-anywhere">
                          {e.reasoning}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )
          ) : entries.length === 0 ? (
            <EmptyState
              size="sm"
              title={
                locked
                  ? 'Nobody was ranked before the deadline.'
                  : 'Add applicants from the pool to start ranking.'
              }
            />
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={entries.map((e) => e.application_id)}
                strategy={verticalListSortingStrategy}
              >
                <ol className="border border-gray-200 lg:max-h-[calc(100dvh-16rem)] lg:overflow-y-auto">
                  {entries.map((entry, i) => (
                    <RankRow
                      key={entry.id}
                      entry={entry}
                      index={i}
                      locked={locked}
                      rating={ratings[entry.application_id]}
                      tags={tagsFor(entry.application_id)}
                      alsoOn={alsoOn.get(entry.application_id) ?? []}
                      comments={
                        isTeam
                          ? list.comments.filter(
                              (c) => c.application_id === entry.application_id
                            )
                          : undefined
                      }
                      currentUserNuid={currentUserNuid}
                      onOpen={() => onOpenApplicant(entry.application_id)}
                      onRemove={() => remove(entry.application_id)}
                      onSaveReasoning={(r) =>
                        saveReasoning(entry.application_id, r)
                      }
                      onAddComment={(body) =>
                        createComment.mutate({
                          listId: list.id,
                          applicationId: entry.application_id,
                          body,
                        })
                      }
                      onEditComment={(commentId, body) =>
                        updateComment.mutate({
                          listId: list.id,
                          commentId,
                          body,
                        })
                      }
                      isAddingComment={createComment.isPending}
                      isEditingComment={updateComment.isPending}
                    />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>
          )}
          {(viewing || !isTeam) && (
            <p className="text-text-subtle text-sm">
              {viewing
                ? `View only. ${viewing.status === 'submitted' ? 'Submitted' : 'Still a draft'}.`
                : 'Your scratchpad. Your team can see it, only you can edit it.'}
            </p>
          )}
        </section>
      </div>
    </div>
  )
}

function RankRow({
  entry,
  index,
  locked,
  rating,
  tags,
  alsoOn,
  comments,
  currentUserNuid,
  onOpen,
  onRemove,
  onSaveReasoning,
  onAddComment,
  onEditComment,
  isAddingComment,
  isEditingComment,
}: {
  entry: RankedEntry
  index: number
  locked: boolean
  rating?: InterviewRating
  tags: CycleTag[]
  alsoOn: { team: string; rank: number }[]
  comments?: PreferenceListComment[]
  currentUserNuid?: string
  onOpen: () => void
  onRemove: () => void
  onSaveReasoning: (reasoning: string) => void
  onAddComment: (body: string) => void
  onEditComment: (commentId: string, body: string) => void
  isAddingComment: boolean
  isEditingComment: boolean
}) {
  const [reasoning, setReasoning] = useState(entry.reasoning ?? '')
  const [focused, setFocused] = useState(false)
  const [prevReasoning, setPrevReasoning] = useState(entry.reasoning)
  if (entry.reasoning !== prevReasoning) {
    setPrevReasoning(entry.reasoning)
    if (!focused) setReasoning(entry.reasoning ?? '')
  }
  const [threadOpen, setThreadOpen] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.application_id, disabled: locked })

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="flex flex-col gap-3 bg-white px-4 py-3 not-first:border-t not-first:border-gray-200"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="font-display text-ink w-7 shrink-0 text-center text-lg font-bold tabular-nums">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={onOpen}
              className="text-ink min-w-0 text-left text-sm font-semibold wrap-anywhere underline-offset-2 hover:underline"
            >
              {entry.full_name}
            </button>
            {entry.returner && <ReturnerBadge />}
          </div>
          <div className="text-text-muted mt-1 flex flex-wrap items-center gap-1.5 text-xs">
            <RatingChip rating={rating} />
            {tags.map((t) => (
              <TagPill key={t.id} tag={t} />
            ))}
            {alsoOn.length > 0 && (
              <Badge size="sm" className="bg-red-50 text-red-700">
                Also on {alsoOn.map((o) => `${o.team} #${o.rank}`).join(', ')}
              </Badge>
            )}
            {comments && (
              <button
                type="button"
                onClick={() => setThreadOpen((v) => !v)}
                aria-expanded={threadOpen}
                className="hover:text-ink inline-flex items-center gap-1"
              >
                <MessageSquare size={12} />
                {comments.length === 0
                  ? 'Comment'
                  : `${comments.length} comment${comments.length === 1 ? '' : 's'}`}
              </button>
            )}
          </div>
          <input
            value={reasoning}
            onChange={(e) => setReasoning(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false)
              if (reasoning !== (entry.reasoning ?? '')) {
                onSaveReasoning(reasoning)
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
            disabled={locked}
            placeholder={locked ? '' : 'Why this spot?'}
            aria-label={`Why ${entry.full_name} is ranked here`}
            className="text-text-muted placeholder:text-text-subtle focus:border-ink focus:text-ink mt-2 w-full border-0 border-b border-dashed border-gray-300 bg-transparent px-0 py-0.5 text-sm outline-none disabled:border-transparent"
          />
        </div>
        {!locked && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label={`Reorder ${entry.full_name}`}
              className="text-text-subtle hover:text-ink cursor-grab touch-none p-1 active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <GripVertical size={16} />
            </button>
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove ${entry.full_name}`}
              className="text-text-subtle p-1 hover:text-red-700"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>
      {comments && threadOpen && (
        <div className="border-t border-gray-200 pt-3 sm:pl-10">
          <CommentThread
            comments={comments}
            currentUserNuid={currentUserNuid}
            onAdd={onAddComment}
            onEdit={onEditComment}
            isAdding={isAddingComment}
            isEditing={isEditingComment}
            placeholder="Add a comment on this applicant…"
          />
        </div>
      )}
    </li>
  )
}
