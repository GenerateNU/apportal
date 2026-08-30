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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CalendarClock } from 'lucide-react'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { MEETING_DAY_LABEL } from '@/app/(portal)/reviewer/applications/components/meetingAvailability'
import type {
  ApplicationSummary,
  MeetingDay,
  PreferenceListComment,
} from '@/lib/api/types'
import { ROLE_LABEL } from '@/lib/roles'
import type { Role } from '@/lib/api/types'
import { EntryRow, type PreferenceEntry } from './EntryRow'

export function RankedList({
  role,
  entries,
  candidates,
  locked,
  emptyText,
  meetingDay,
  availabilityBadgeFor,
  draftedByApplicationId,
  onOpenSettings,
  onOpenApplicant,
  onAdd,
  onReorder,
  onRemove,
  onSaveReasoning,
  commentsFor,
  currentUserNuid,
  onAddComment,
  onEditComment,
  isAddingComment,
  isEditingComment,
}: {
  role: Role
  entries: PreferenceEntry[]
  candidates: ApplicationSummary[]
  locked: boolean
  emptyText: string
  meetingDay?: MeetingDay | null
  availabilityBadgeFor: (
    applicationId: string,
    role: Role
  ) => { label: string; className: string } | undefined
  draftedByApplicationId: Record<string, string | undefined>
  onOpenSettings: () => void
  onOpenApplicant: (entry: PreferenceEntry) => void
  onAdd: (applicationId: string) => void
  onReorder: (applicationIds: string[]) => void
  onRemove: (applicationId: string) => void
  onSaveReasoning: (applicationId: string, reasoning: string) => void
  commentsFor?: (applicationId: string) => PreferenceListComment[]
  currentUserNuid?: string
  onAddComment?: (applicationId: string, body: string) => void
  onEditComment?: (commentId: string, body: string) => void
  isAddingComment?: boolean
  isEditingComment?: boolean
}) {
  const [hideDrafted, setHideDrafted] = useState(false)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const draftedCount = entries.filter(
    (e) => draftedByApplicationId[e.application_id]
  ).length
  // Hiding only changes what's on screen — ranks stay whatever the server
  // holds, so a hidden entry never silently loses its place.
  const visible = hideDrafted
    ? entries.filter((e) => !draftedByApplicationId[e.application_id])
    : entries

  const busyCount = meetingDay
    ? entries.filter(
        (e) => availabilityBadgeFor(e.application_id, role)?.label === 'Busy'
      ).length
    : 0

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids = entries.map((e) => e.application_id)
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from === -1 || to === -1) return
    const next = [...ids]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onReorder(next)
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-text-default text-sm font-semibold">
          {entries.length} ranked
        </span>
        {meetingDay && busyCount > 0 && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="text-text-muted hover:text-text-default inline-flex items-center gap-1 text-xs"
          >
            <CalendarClock size={12} />
            {busyCount} busy on {MEETING_DAY_LABEL[meetingDay]}
          </button>
        )}
        {draftedCount > 0 && (
          <button
            type="button"
            onClick={() => setHideDrafted((v) => !v)}
            className="text-text-muted hover:text-text-default text-xs underline-offset-2 hover:underline"
          >
            {hideDrafted
              ? `Show ${draftedCount} drafted`
              : `Hide ${draftedCount} drafted`}
          </button>
        )}
      </div>

      {/* Above the list, not below it: appending to the bottom of a long
          ranking means scrolling past everything to add, then dragging the
          new entry back up to where it belongs. */}
      {!locked && (
        <SearchableSelect
          options={candidates.map((a) => ({
            value: a.id,
            label: a.full_name || a.user_nuid,
            badge: availabilityBadgeFor(a.id, role),
          }))}
          onValueChange={onAdd}
          placeholder={`Add a ${ROLE_LABEL[role].toLowerCase()}…`}
          searchPlaceholder="Search applicants…"
          emptyText="No matching applicants."
          className="w-full sm:w-72"
          ariaLabel={`Add a ${ROLE_LABEL[role].toLowerCase()} applicant`}
        />
      )}

      {entries.length === 0 ? (
        <p className="text-text-faint text-sm">{emptyText}</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={visible.map((e) => e.application_id)}
            strategy={verticalListSortingStrategy}
          >
            <ol className="flex flex-col gap-2">
              {visible.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  availabilityBadge={availabilityBadgeFor(
                    entry.application_id,
                    role
                  )}
                  draftedBy={draftedByApplicationId[entry.application_id]}
                  index={entries.indexOf(entry)}
                  locked={locked}
                  onOpenApplicant={() => onOpenApplicant(entry)}
                  onRemove={() => onRemove(entry.application_id)}
                  onSaveReasoning={(reasoning) =>
                    onSaveReasoning(entry.application_id, reasoning)
                  }
                  comments={commentsFor?.(entry.application_id)}
                  currentUserNuid={currentUserNuid}
                  onAddComment={(body) =>
                    onAddComment?.(entry.application_id, body)
                  }
                  onEditComment={onEditComment}
                  isAddingComment={isAddingComment}
                  isEditingComment={isEditingComment}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}
    </section>
  )
}
