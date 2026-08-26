'use client'

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
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
  ArrowDown,
  ArrowUp,
  GripVertical,
  Loader2,
  Plus,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { DraftBoard, PreferenceListSummary } from '@/lib/api/types'
import { SECTION_CLASS, SECTION_HEADER_CLASS } from './constants'

// The order editor, shown while the draft is still in setup. Seats are
// preference list groups; everything about the board — who picks when, whose
// ranked list is on screen — follows from this order, so it's frozen the
// moment picking starts.
export function DraftSetup({
  board,
  groups,
  order,
  rounds,
  onToggle,
  onMove,
  onReorder,
  onRoundsChange,
  onSave,
  onStart,
  saving,
  starting,
}: {
  board: DraftBoard
  groups: PreferenceListSummary[]
  // Preference list ids, in pick order.
  order: string[]
  rounds: number
  onToggle: (id: string) => void
  onMove: (index: number, direction: -1 | 1) => void
  // Drag drops a seat at an arbitrary index; onMove only ever shifts by one.
  onReorder: (from: number, to: number) => void
  onRoundsChange: (rounds: number) => void
  onSave: () => void
  onStart: () => void
  saving: boolean
  starting: boolean
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = order.indexOf(String(active.id))
    const to = order.indexOf(String(over.id))
    if (from === -1 || to === -1) return
    onReorder(from, to)
  }

  const byId = new Map(groups.map((g) => [g.id, g]))
  const unselected = groups.filter((g) => !order.includes(g.id))
  // Saving is what puts the seats on the board; starting before that would
  // begin a draft with nobody in it.
  const unsaved =
    order.join(',') !== board.teams.map((t) => t.preference_list_id).join(',')

  return (
    <>
      <div className={SECTION_CLASS}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className={SECTION_HEADER_CLASS}>Draft order</h2>
          <span className="text-text-subtle text-xs">
            {order.length} teams × {rounds} rounds = {order.length * rounds}{' '}
            picks
          </span>
        </div>

        {order.length === 0 ? (
          <p className="text-text-muted text-sm">
            Add the groups drafting this role, then put them in the order they
            pick.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={order}
              strategy={verticalListSortingStrategy}
            >
              <ol className="flex flex-col gap-2">
                {order.map((id, index) => (
                  <SeatRow
                    key={id}
                    id={id}
                    index={index}
                    total={order.length}
                    name={byId.get(id)?.name ?? id}
                    memberNames={byId.get(id)?.member_names ?? []}
                    onMove={onMove}
                    onRemove={() => onToggle(id)}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <div className={SECTION_CLASS}>
        <h2 className={SECTION_HEADER_CLASS}>Groups not drafting</h2>
        {unselected.length === 0 ? (
          <p className="text-text-muted text-sm">
            Every group in this cycle is in the draft.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {unselected.map((g) => (
              <li
                key={g.id}
                className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-text-secondary block truncate text-sm font-medium">
                    {g.name}
                  </span>
                  <span className="text-text-subtle block truncate text-xs">
                    {g.member_count} members · {g.entry_count} ranked
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onToggle(g.id)}
                  className="shrink-0"
                >
                  <Plus size={13} />
                  Add
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={SECTION_CLASS}>
        <h2 className={SECTION_HEADER_CLASS}>Rounds</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            id="draft-rounds"
            type="number"
            min={1}
            value={rounds}
            onChange={(e) => onRoundsChange(Number(e.target.value))}
            aria-label="Rounds"
            className="h-9 w-24"
          />
          <span className="text-text-muted text-sm">
            How many times around the board. You can add more mid-draft.
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={onSave} disabled={saving}>
          {saving && <Loader2 className="animate-spin" size={14} />}
          Save order
        </Button>
        <Button
          onClick={onStart}
          disabled={starting || board.teams.length === 0 || unsaved}
        >
          {starting && <Loader2 className="animate-spin" size={14} />}
          Start draft
        </Button>
        {unsaved && order.length > 0 && (
          <span className="text-text-muted text-xs">
            Save the order before starting.
          </span>
        )}
      </div>
    </>
  )
}

// One seat in the order. Drag to move it anywhere; the arrows stay as the
// keyboard- and precision-friendly fallback, the same pairing the form
// builder's question cards use.
function SeatRow({
  id,
  index,
  total,
  name,
  memberNames,
  onMove,
  onRemove,
}: {
  id: string
  index: number
  total: number
  name: string
  memberNames: string[]
  onMove: (index: number, direction: -1 | 1) => void
  onRemove: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm transition-shadow hover:shadow-md"
    >
      <button
        type="button"
        aria-label={`Drag ${name} to reorder`}
        className="text-text-faint hover:text-text-subtle cursor-grab touch-none rounded-md p-1 hover:bg-gray-100 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="bg-brand-blue/10 text-brand-blue flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <span className="text-text-default block truncate text-sm font-medium">
          {name}
        </span>
        <span className="text-text-subtle block truncate text-xs">
          {memberNames.length ? memberNames.join(', ') : 'No members'}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onMove(index, -1)}
          disabled={index === 0}
          aria-label={`Move ${name} up`}
          className="text-text-subtle hover:text-brand-blue disabled:hover:text-text-subtle rounded p-1 transition-colors disabled:opacity-30"
        >
          <ArrowUp size={14} />
        </button>
        <button
          type="button"
          onClick={() => onMove(index, 1)}
          disabled={index === total - 1}
          aria-label={`Move ${name} down`}
          className="text-text-subtle hover:text-brand-blue disabled:hover:text-text-subtle rounded p-1 transition-colors disabled:opacity-30"
        >
          <ArrowDown size={14} />
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${name} from the draft`}
          className="text-text-subtle hover:text-destructive rounded p-1 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </li>
  )
}
