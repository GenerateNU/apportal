'use client'

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Check,
  ChevronDown,
  ChevronRight,
  GripVertical,
  MessageSquare,
  X,
} from 'lucide-react'
import { ReturnerBadge } from '@/components/ReturnerBadge'
import { Label } from '@/components/ui/label'
import type { PreferenceListComment } from '@/lib/api/types'
import { CommentThread } from './CommentThread'

export type PreferenceEntry = {
  id: string
  application_id: string
  full_name: string
  email: string
  reasoning?: string
  returner: boolean
}

// Collapsed by default: a ranked list is read top-to-bottom to compare
// candidates, and a textarea per row buries the ordering under its own
// chrome. Reasoning and comments stay one click away.
export function EntryRow({
  entry,
  availabilityBadge,
  draftedBy,
  index,
  locked,
  onRemove,
  onSaveReasoning,
  comments,
  currentUserNuid,
  onAddComment,
  onEditComment,
  isAddingComment,
  isEditingComment,
}: {
  entry: PreferenceEntry
  availabilityBadge?: { label: string; className: string }
  // The team that took them on a draft board, if any.
  draftedBy?: string
  index: number
  locked: boolean
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
  const [expanded, setExpanded] = useState(false)
  // Set once this row has sent an edit, so the indicator below distinguishes
  // "never touched" from "saved". Persistence is read off the entry itself
  // rather than the mutation, so it reflects what the server actually holds.
  const [everSaved, setEverSaved] = useState(false)
  const pendingSave = everSaved && (entry.reasoning ?? '') !== reasoning

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.application_id, disabled: locked })

  const commentCount = comments?.length ?? 0

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3"
    >
      <div className="flex items-start gap-3">
        <div className="flex shrink-0 items-center gap-1 pt-0.5">
          <span className="text-text-subtle w-5 text-right text-sm font-semibold tabular-nums">
            {index + 1}
          </span>
          {!locked && (
            <button
              type="button"
              aria-label={`Reorder ${entry.full_name}`}
              className="text-text-faint hover:text-text-muted cursor-grab touch-none active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <GripVertical size={14} />
            </button>
          )}
        </div>

        {/* Chevron leads the name, the way Group settings above discloses
            itself — one obvious control, and well clear of Remove. */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-start gap-1.5 text-left"
        >
          <span className="text-text-faint pt-0.5">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-1.5">
              <span
                className={`text-sm font-medium ${
                  draftedBy
                    ? 'text-text-faint line-through'
                    : 'text-text-default'
                }`}
              >
                {entry.full_name}
              </span>
              {entry.returner && <ReturnerBadge />}
              {draftedBy && (
                <span className="text-text-muted rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium">
                  Drafted · {draftedBy}
                </span>
              )}
              {availabilityBadge && (
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${availabilityBadge.className}`}
                >
                  {availabilityBadge.label}
                </span>
              )}
              {commentCount > 0 && (
                <span className="text-text-faint inline-flex items-center gap-0.5 text-[10px]">
                  <MessageSquare size={10} />
                  {commentCount}
                </span>
              )}
            </span>
            {!expanded && (
              <span className="text-text-subtle mt-0.5 block truncate text-xs">
                {reasoning || entry.email}
              </span>
            )}
          </span>
        </button>

        {!locked && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${entry.full_name}`}
            className="text-text-faint hover:text-destructive shrink-0 border-l border-gray-100 pl-3"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {expanded && (
        <div className="flex flex-col gap-1.5 pl-7">
          <p className="text-text-subtle text-xs">{entry.email}</p>
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs" htmlFor={`reasoning-${entry.id}`}>
              Reasoning
            </Label>
            {everSaved && (
              <span className="text-text-faint inline-flex items-center gap-1 text-xs">
                {pendingSave ? (
                  'Saving…'
                ) : (
                  <>
                    <Check size={12} />
                    Saved
                  </>
                )}
              </span>
            )}
          </div>
          <textarea
            id={`reasoning-${entry.id}`}
            value={reasoning}
            onChange={(e) => setReasoning(e.target.value)}
            onFocus={() => setReasoningFocused(true)}
            onBlur={() => {
              setReasoningFocused(false)
              if (reasoning !== (entry.reasoning ?? '')) {
                onSaveReasoning(reasoning)
                setEverSaved(true)
              }
            }}
            disabled={locked}
            placeholder="Why this rank?"
            rows={2}
            className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-60"
          />
          {comments && (
            <div className="border-t border-gray-100 pt-2">
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
    </li>
  )
}
