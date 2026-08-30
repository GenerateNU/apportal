'use client'

import { useState } from 'react'
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
import { GripVertical, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { DraftBoard } from '@/lib/api/types'

// Reordering a live board only moves who's up next: a pick already made
// keeps the team that made it, and the rest of the current round goes to the
// teams yet to pick in it. Teams can't be added or dropped here — the server
// rejects that once picking has started, since dropping one would take its
// picks and their stage changes with it.
export function ReorderTeamsDialog({
  board,
  open,
  onOpenChange,
  onSave,
  saving,
  error,
}: {
  board: DraftBoard
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (preferenceListIds: string[]) => void
  saving: boolean
  error?: string
}) {
  // Seeded per opening, then owned here so dragging doesn't fight the 8s poll.
  const [order, setOrder] = useState<string[] | null>(null)
  const current = board.teams.map((t) => t.preference_list_id)
  const working = order ?? current
  const byListId = new Map(board.teams.map((t) => [t.preference_list_id, t]))
  const pickedCount = new Map<string, number>()
  for (const pick of board.picks) {
    const team = board.teams.find((t) => t.id === pick.draft_team_id)
    if (!team) continue
    pickedCount.set(
      team.preference_list_id,
      (pickedCount.get(team.preference_list_id) ?? 0) + 1
    )
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = working.indexOf(String(active.id))
    const to = working.indexOf(String(over.id))
    if (from === -1 || to === -1) return
    const next = [...working]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setOrder(next)
  }

  const unchanged = working.every((id, i) => id === current[i])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setOrder(null)
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reorder the pick order</DialogTitle>
          <DialogDescription>
            Picks already made stay with the team that made them. The rest of
            the current round goes to the teams yet to pick in it, and later
            rounds follow the new order.
          </DialogDescription>
        </DialogHeader>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={working}
            strategy={verticalListSortingStrategy}
          >
            <ol className="flex flex-col gap-2">
              {working.map((listId, index) => (
                <SeatRow
                  key={listId}
                  id={listId}
                  index={index}
                  name={byListId.get(listId)?.name ?? listId}
                  picked={pickedCount.get(listId) ?? 0}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => onSave(working)}
            disabled={saving || unchanged}
          >
            {saving ? (
              <>
                <Loader2 className="animate-spin" size={14} />
                Saving…
              </>
            ) : (
              'Save order'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SeatRow({
  id,
  index,
  name,
  picked,
}: {
  id: string
  index: number
  name: string
  picked: number
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
      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5"
    >
      <span className="text-text-subtle w-4 text-right text-sm font-semibold tabular-nums">
        {index + 1}
      </span>
      <button
        type="button"
        aria-label={`Reorder ${name}`}
        className="text-text-faint hover:text-text-muted cursor-grab touch-none active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </button>
      <span className="text-text-default min-w-0 flex-1 truncate text-sm font-medium">
        {name}
      </span>
      {picked > 0 && (
        <span className="text-text-faint shrink-0 text-xs">
          {picked} pick{picked === 1 ? '' : 's'}
        </span>
      )}
    </li>
  )
}
