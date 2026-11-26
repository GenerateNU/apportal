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
  Columns2,
  ListOrdered,
  MessageSquare,
  Pencil,
  Send,
  Undo2,
  Users,
  X,
} from 'lucide-react'
import { ReturnerBadge } from '@/components/ReturnerBadge'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ListActionChip, type ListAction } from '../../components/AddToMyList'
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
import type {
  ApplicationSummary,
  InterviewRating,
  PreferenceListComment,
  PreferenceListDetail,
} from '@/lib/api/types'
import { RATING_LABEL } from '@/lib/interview-ratings'
import {
  useCreatePreferenceListComment,
  useDeletePreferenceListEntry,
  useReorderPreferenceListEntries,
  useUpdatePreferenceList,
  useUpdatePreferenceListComment,
  useUpsertPreferenceListEntry,
} from '@/lib/queries/preference-lists'
import { useRoleLookup } from '@/lib/queries/roles'
import { CommentThread } from './CommentThread'
import { deadlinePassed } from './deadline'
import { PlacementsBlock, type TeamPlacements } from './PlacementsBlock'

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

const NO_TAGS: CycleTag[] = []

type Layout = 'explore' | 'split' | 'list'

const LAYOUTS: { id: Layout; label: string; Icon: typeof Users }[] = [
  { id: 'explore', label: 'Explore applicants', Icon: Users },
  { id: 'list', label: 'Our list', Icon: ListOrdered },
  { id: 'split', label: 'Side by side', Icon: Columns2 },
]

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
  renderExplorer,
  placements = [],
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
  renderExplorer: (listAction: ListAction) => React.ReactNode
  placements?: TeamPlacements[]
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
  const [layout, setLayout] = useState<Layout>('split')
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

  const updateList = useUpdatePreferenceList()
  const upsertEntry = useUpsertPreferenceListEntry()
  const deleteEntry = useDeletePreferenceListEntry()
  const reorderEntries = useReorderPreferenceListEntries()
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
  const locked = roleLocked

  const entries: RankedEntry[] = useMemo(
    () => list.entries.filter((e) => e.role_id === role),
    [list.entries, role]
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

  function add(applicationId: string) {
    upsertEntry.mutate({ listId: list.id, applicationId })
  }

  function remove(applicationId: string) {
    deleteEntry.mutate({ listId: list.id, applicationId })
  }

  const rankOf = new Map(entries.map((e, i) => [e.application_id, i + 1]))
  const pendingId = [upsertEntry, deleteEntry].find((m) => m.isPending)
    ?.variables?.applicationId
  const listAction: ListAction = {
    listId: list.id,
    render: (applicationId, variant) => (
      <ListActionChip
        variant={variant}
        rank={rankOf.get(applicationId)}
        listName={list.name}
        locked={locked}
        pending={pendingId === applicationId}
        onAdd={() => add(applicationId)}
        onRemove={() => remove(applicationId)}
      />
    ),
  }

  function saveReasoning(applicationId: string, reasoning: string) {
    upsertEntry.mutate({ listId: list.id, applicationId, reasoning })
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
    reorderEntries.mutate({ listId: list.id, applicationIds: next })
  }

  const submitted = list.status === 'submitted'
  const [confirmingSubmit, setConfirmingSubmit] = useState(false)
  function setStatus(status: 'draft' | 'submitted') {
    updateList.mutate(
      { id: list.id, cycleId: list.cycle_id, body: { status } },
      { onSuccess: () => setConfirmingSubmit(false) }
    )
  }
  const countsByRole = roleIds.map((r) => ({
    id: r,
    label: roleLabel(r),
    count: list.entries.filter((e) => e.role_id === r).length,
  }))
  const emptyRoles = countsByRole.filter((r) => r.count === 0)
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3 border-b border-gray-200">
        {roleTabs}
        <span className="flex-1" />
        <div
          role="radiogroup"
          aria-label="Layout"
          className="mb-3 inline-flex h-9 border border-gray-200 bg-white"
        >
          {LAYOUTS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={layout === id}
              onClick={() => setLayout(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 text-sm whitespace-nowrap transition-colors not-last:border-r not-last:border-gray-200',
                layout === id
                  ? 'text-ink bg-gray-100 font-medium'
                  : 'text-text-muted hover:text-ink'
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
        <Button
          variant={submitted ? 'brutal' : 'brutal-ink'}
          size="lg"
          className="mb-3 px-4"
          disabled={groupLocked || updateList.isPending}
          onClick={() =>
            submitted ? setStatus('draft') : setConfirmingSubmit(true)
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

      {placements.length > 0 && <PlacementsBlock placements={placements} />}

      <div
        className={cn(
          'grid items-start gap-6',
          layout === 'split' && 'xl:grid-cols-[minmax(0,1fr)_26rem]'
        )}
      >
        <section className={cn('min-w-0', layout === 'list' && 'hidden')}>
          {renderExplorer(listAction)}
        </section>
        {layout !== 'explore' && (
          <aside
            className={cn(
              'flex min-w-0 flex-col gap-3',
              layout === 'split' &&
                'xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:border-l xl:border-gray-200 xl:pl-6'
            )}
          >
            <PanelHeading
              action={
                <>
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
              {viewing ? viewing.name : 'Our ranking'}
            </PanelHeading>
            <div
              className={cn(
                'flex min-h-0 flex-col gap-3',
                layout === 'split' &&
                  'max-h-[70vh] overflow-y-auto xl:max-h-none xl:flex-1'
              )}
            >
              {viewing ? (
                viewingEntries.length === 0 ? (
                  <EmptyState
                    size="sm"
                    title={`${viewing.name} hasn't ranked anyone for ${roleLabel(role)} yet.`}
                  />
                ) : (
                  <ol className="border border-gray-200">
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
                      : 'Add applicants from the left to start ranking.'
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
                    <ol className="border border-gray-200">
                      {entries.map((entry, i) => (
                        <RankRow
                          key={entry.id}
                          entry={entry}
                          index={i}
                          locked={locked}
                          rating={ratings[entry.application_id]}
                          tags={tagsFor(entry.application_id)}
                          alsoOn={alsoOn.get(entry.application_id) ?? []}
                          comments={list.comments.filter(
                            (c) => c.application_id === entry.application_id
                          )}
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
            </div>
          </aside>
        )}
      </div>

      <ConfirmDialog
        open={confirmingSubmit}
        onOpenChange={setConfirmingSubmit}
        title={`Submit ${list.name}'s list?`}
        description="Chiefs will use this ranking in the draft. You can move it back to draft until the deadline."
        confirmLabel="Submit team list"
        confirmVariant="default"
        pending={updateList.isPending}
        onConfirm={() => setStatus('submitted')}
      >
        <ul className="border border-gray-200 text-sm">
          {countsByRole.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between px-3 py-2 not-first:border-t not-first:border-gray-200"
            >
              <span className="text-ink">{r.label}</span>
              <span
                className={cn(
                  'tabular-nums',
                  r.count === 0 ? 'font-medium text-red-700' : 'text-text-muted'
                )}
              >
                {r.count === 0 ? 'No one ranked' : `${r.count} ranked`}
              </span>
            </li>
          ))}
        </ul>
        {emptyRoles.length > 0 && (
          <p className="text-sm text-red-700">
            {emptyRoles.map((r) => r.label).join(' and ')}{' '}
            {emptyRoles.length === 1 ? 'has' : 'have'} no one ranked yet.
          </p>
        )}
      </ConfirmDialog>
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
  const [editing, setEditing] = useState(false)
  const [prevReasoning, setPrevReasoning] = useState(entry.reasoning)
  if (entry.reasoning !== prevReasoning) {
    setPrevReasoning(entry.reasoning)
    if (!editing) setReasoning(entry.reasoning ?? '')
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
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onOpen}
              className="text-ink min-w-0 text-left text-sm font-semibold wrap-anywhere underline-offset-2 hover:underline"
            >
              {entry.full_name}
            </button>
            {entry.returner && <ReturnerBadge />}
            <span className="flex-1" />
            <div className="-my-1 -mr-1 flex shrink-0 items-center gap-0.5">
              {comments && (
                <button
                  type="button"
                  onClick={() => setThreadOpen((v) => !v)}
                  aria-expanded={threadOpen}
                  aria-label={
                    comments.length === 0
                      ? 'Comment'
                      : `${comments.length} comment${comments.length === 1 ? '' : 's'}`
                  }
                  title="Comments"
                  className={cn(
                    'inline-flex items-center gap-1 p-1 text-xs tabular-nums transition-colors',
                    threadOpen || comments.length > 0
                      ? 'text-ink'
                      : 'text-text-subtle hover:text-ink'
                  )}
                >
                  <MessageSquare size={15} />
                  {comments.length > 0 && comments.length}
                </button>
              )}
              {!locked && (
                <>
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
                </>
              )}
            </div>
          </div>
          <div className="text-text-muted mt-1 flex flex-wrap items-center gap-1.5 text-xs">
            <RatingChip rating={rating} />
            {tags.map((t) => (
              <TagPill key={t.id} tag={t} />
            ))}
            {alsoOn.length > 0 && (
              <span className="flex w-full items-start gap-1 text-xs text-red-700">
                <Users size={12} className="mt-0.5 shrink-0" />
                <span>
                  Also on{' '}
                  {alsoOn.map((o, i) => (
                    <span key={o.team} className="whitespace-nowrap">
                      {o.team} #{o.rank}
                      {i < alsoOn.length - 1 && ', '}
                    </span>
                  ))}
                </span>
              </span>
            )}
          </div>
          <div className="mt-2 text-sm">
            <div className="min-w-0">
              {editing ? (
                <textarea
                  autoFocus
                  rows={2}
                  value={reasoning}
                  onChange={(e) => setReasoning(e.target.value)}
                  onBlur={() => {
                    setEditing(false)
                    if (reasoning !== (entry.reasoning ?? '')) {
                      onSaveReasoning(reasoning)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      e.currentTarget.blur()
                    }
                    if (e.key === 'Escape') {
                      setReasoning(entry.reasoning ?? '')
                      setEditing(false)
                    }
                  }}
                  placeholder="Why are they at this spot?"
                  aria-label={`Why ${entry.full_name} is ranked here`}
                  className="text-ink placeholder:text-text-subtle focus:border-ink w-full resize-none border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none"
                />
              ) : reasoning ? (
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => setEditing(true)}
                  title={locked ? undefined : 'Edit reason'}
                  className="text-text-default enabled:hover:text-ink w-full border-l-2 border-gray-300 pl-2 text-left wrap-anywhere"
                >
                  {reasoning}
                </button>
              ) : (
                !locked && (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="text-text-subtle hover:text-ink inline-flex items-center gap-1.5"
                  >
                    <Pencil size={12} />
                    Add a reason
                  </button>
                )
              )}
            </div>
          </div>
        </div>
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
