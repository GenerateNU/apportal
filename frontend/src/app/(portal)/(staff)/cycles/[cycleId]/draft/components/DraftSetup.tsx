'use client'

import { useState } from 'react'

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
import { ArrowDown, ArrowUp, GripVertical, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SectionLabel } from '@/components/ui/section-label'
import type { DraftBoard, PreferenceListSummary } from '@/lib/api/types'

// The order editor, shown while the draft is still in setup. Seats are
// preference list groups; everything about the board — who picks when, whose
// ranked list is on screen — follows from this order, so it's frozen the
// moment picking starts.
export function DraftSetup({
  board,
  groups,
  order,
  rounds,
  onMove,
  onReorder,
  onRoundsChange,
  onSave,
  onStart,
  saving,
  starting,
  placements,
  placementRounds = 0,
  startBlocked,
}: {
  board: DraftBoard
  groups: PreferenceListSummary[]
  // Preference list ids, in pick order.
  order: string[]
  rounds: number
  onMove: (index: number, direction: -1 | 1) => void
  // Drag drops a seat at an arbitrary index; onMove only ever shifts by one.
  onReorder: (from: number, to: number) => void
  onRoundsChange: (rounds: number) => void
  onSave: () => void
  onStart: () => void
  saving: boolean
  starting: boolean
  placements?: React.ReactNode
  placementRounds?: number
  startBlocked?: string
}) {
  const [roundsText, setRoundsText] = useState<string | null>(null)
  const sensors = useSensors(
    // Without a threshold, a tap on the row's buttons starts a drag on touch.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
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
  const unsaved =
    order.join(',') !== board.teams.map((t) => t.preference_list_id).join(',')

  return (
    <>
      <Card padding="none" className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionLabel>Draft order</SectionLabel>
          <span className="text-text-subtle text-xs">
            {order.length} teams × {rounds} rounds = {order.length * rounds}{' '}
            picks
            {placementRounds > 0 &&
              ` + ${order.length * placementRounds} placed`}
          </span>
        </div>

        {order.length === 0 ? (
          <p className="text-text-muted text-sm">
            No teams yet. Create them on the Teams page.
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
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}
      </Card>

      <Card padding="none" className="flex flex-col gap-3 p-5">
        <SectionLabel>Rounds</SectionLabel>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            id="draft-rounds"
            type="number"
            min={1}
            value={roundsText ?? String(rounds)}
            onChange={(e) => {
              setRoundsText(e.target.value)
              const n = Number(e.target.value)
              if (Number.isInteger(n) && n >= 1) onRoundsChange(n)
            }}
            onBlur={() => setRoundsText(null)}
            aria-label="Rounds"
            className="h-9 w-24"
          />
          <span className="text-text-muted text-sm">
            How many times around the board. You can add more mid-draft.
          </span>
        </div>
      </Card>

      {placements}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={onStart}
          disabled={starting || saving || order.length === 0 || !!startBlocked}
        >
          {(starting || saving) && (
            <Loader2 className="animate-spin" size={14} />
          )}
          Start draft
        </Button>
        {unsaved && order.length > 0 && (
          <Button variant="outline" onClick={onSave} disabled={saving}>
            Save order
          </Button>
        )}
        {startBlocked && (
          <span className="text-text-muted text-sm">{startBlocked}</span>
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
}: {
  id: string
  index: number
  total: number
  name: string
  memberNames: string[]
  onMove: (index: number, direction: -1 | 1) => void
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
      className="flex items-center gap-2 border border-gray-200 bg-white px-3 py-2.5"
    >
      <button
        type="button"
        aria-label={`Drag ${name} to reorder`}
        className="text-text-faint hover:text-text-subtle cursor-grab touch-none p-1 hover:bg-gray-100 active:cursor-grabbing pointer-coarse:p-2"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="bg-ink/10 text-ink flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
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
          className="text-text-subtle hover:text-ink disabled:hover:text-text-subtle p-1 transition-colors disabled:opacity-30 pointer-coarse:p-2"
        >
          <ArrowUp size={14} />
        </button>
        <button
          type="button"
          onClick={() => onMove(index, 1)}
          disabled={index === total - 1}
          aria-label={`Move ${name} down`}
          className="text-text-subtle hover:text-ink disabled:hover:text-text-subtle p-1 transition-colors disabled:opacity-30 pointer-coarse:p-2"
        >
          <ArrowDown size={14} />
        </button>
      </div>
    </li>
  )
}
