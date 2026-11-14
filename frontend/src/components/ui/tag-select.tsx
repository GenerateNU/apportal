'use client'

import { useState } from 'react'
import {
  Check,
  ChevronLeft,
  MoreHorizontal,
  Plus,
  Tag as TagIcon,
  X,
} from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import type { CycleTag } from '@/lib/api/types'
import { cn } from '@/lib/utils'

// Keep in step with Palette in backend/internal/handlers/tag/tag_service.go.
export const TAG_COLORS = [
  'gray',
  'brown',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
  'red',
] as const

const TAG_COLOR_CLASS: Record<string, string> = {
  gray: 'bg-gray-100 text-gray-700',
  brown: 'bg-amber-100 text-amber-900',
  orange: 'bg-orange-100 text-orange-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  green: 'bg-green-100 text-green-800',
  blue: 'bg-blue-100 text-blue-800',
  purple: 'bg-purple-100 text-purple-800',
  pink: 'bg-pink-100 text-pink-800',
  red: 'bg-red-100 text-red-800',
}

export function TagPill({
  tag,
  onRemove,
}: {
  tag: Pick<CycleTag, 'name' | 'color'>
  onRemove?: () => void
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-40 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
        TAG_COLOR_CLASS[tag.color] ?? TAG_COLOR_CLASS.gray
      )}
    >
      <span className="truncate">{tag.name}</span>
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${tag.name}`}
          onClick={onRemove}
          className="shrink-0 opacity-60 hover:opacity-100"
        >
          <X size={12} />
        </button>
      )}
    </span>
  )
}

// Notion-style multi-select: pick existing tags, or type a new name and
// choose "Create". Selection is capped at `max`.
export function TagSelect({
  tags,
  selectedIds,
  max,
  onChange,
  onCreate,
  onRename,
  onRecolor,
  onDelete,
  disabled,
  compact,
}: {
  // Show a tag icon with the count instead of the tags themselves; the list
  // opens on click. For tight spots like cards.
  compact?: boolean
  tags: CycleTag[]
  selectedIds: string[]
  max: number
  onChange: (ids: string[]) => void
  onCreate: (name: string) => Promise<CycleTag>
  onRename: (id: string, name: string) => Promise<unknown>
  onRecolor: (id: string, color: string) => Promise<unknown>
  onDelete: (id: string) => Promise<unknown>
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selected = selectedIds
    .map((id) => tags.find((t) => t.id === id))
    .filter((t): t is CycleTag => !!t)
  const full = selectedIds.length >= max
  const trimmed = query.trim()
  const needle = trimmed.toLowerCase()
  const filtered = needle
    ? tags.filter((t) => t.name.toLowerCase().includes(needle))
    : tags
  const exactMatch = tags.some((t) => t.name.toLowerCase() === needle)
  const editing = tags.find((t) => t.id === editingId)

  const reset = () => {
    setQuery('')
    setEditingId(null)
    setError(null)
  }

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((s) => s !== id))
    } else if (!full) {
      onChange([...selectedIds, id])
    }
  }

  const create = async () => {
    setError(null)
    try {
      const tag = await onCreate(trimmed)
      setQuery('')
      onChange([...selectedIds, tag.id])
    } catch {
      setError('Could not create that tag.')
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {!compact &&
        selected.map((t) => (
          <TagPill
            key={t.id}
            tag={t}
            onRemove={
              disabled
                ? undefined
                : () => onChange(selectedIds.filter((s) => s !== t.id))
            }
          />
        ))}
      {!disabled && (
        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next)
            if (!next) reset()
          }}
        >
          <PopoverTrigger asChild>
            {compact ? (
              <button
                type="button"
                aria-label={
                  selected.length > 0
                    ? `Edit tags (${selected.map((t) => t.name).join(', ')})`
                    : 'Add tags'
                }
                title={selected.map((t) => t.name).join(', ') || 'Add tags'}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs hover:bg-gray-100',
                  selected.length > 0
                    ? 'text-text-default font-medium'
                    : 'text-text-faint'
                )}
              >
                <TagIcon size={14} />
                {selected.length > 0 && selected.length}
              </button>
            ) : (
              <button
                type="button"
                aria-label="Edit tags"
                className="text-text-subtle inline-flex items-center gap-1 rounded-md border border-dashed border-gray-300 px-2 py-0.5 text-xs hover:border-gray-400"
              >
                <Plus size={12} />
                {selected.length === 0 ? 'Add tag' : null}
              </button>
            )}
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            {editing ? (
              <EditPanel
                key={editing.id}
                tag={editing}
                onBack={() => setEditingId(null)}
                onRename={onRename}
                onRecolor={onRecolor}
                onDelete={async (id) => {
                  await onDelete(id)
                  setEditingId(null)
                }}
              />
            ) : (
              <>
                <div className="border-b border-gray-100 p-2">
                  <Input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search or create a tag…"
                    className="h-8"
                    maxLength={40}
                  />
                </div>
                <p className="text-text-faint px-3 pt-2 text-xs">
                  {full
                    ? `Up to ${max} tags — remove one to add another.`
                    : 'Select an option or create one'}
                </p>
                <div className="max-h-64 overflow-y-auto p-1">
                  {filtered.map((t) => {
                    const isSelected = selectedIds.includes(t.id)
                    return (
                      <div
                        key={t.id}
                        className="hover:bg-muted flex items-center gap-1 rounded-md pr-1"
                      >
                        <button
                          type="button"
                          disabled={full && !isSelected}
                          onClick={() => toggle(t.id)}
                          className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left disabled:opacity-40"
                        >
                          <Check
                            size={14}
                            className={isSelected ? 'opacity-100' : 'opacity-0'}
                          />
                          <TagPill tag={t} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Edit ${t.name}`}
                          onClick={() => setEditingId(t.id)}
                          className="text-text-faint hover:text-text-default rounded p-1"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                      </div>
                    )
                  })}
                  {trimmed && !exactMatch && !full && (
                    <button
                      type="button"
                      onClick={create}
                      className="hover:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm"
                    >
                      Create
                      <TagPill tag={{ name: trimmed, color: 'gray' }} />
                    </button>
                  )}
                  {filtered.length === 0 && !trimmed && (
                    <p className="text-text-faint px-2 py-1.5 text-sm">
                      No tags yet — type a name to create one.
                    </p>
                  )}
                </div>
                {error && (
                  <p className="px-3 pb-2 text-xs text-red-600">{error}</p>
                )}
              </>
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}

function EditPanel({
  tag,
  onBack,
  onRename,
  onRecolor,
  onDelete,
}: {
  tag: CycleTag
  onBack: () => void
  onRename: (id: string, name: string) => Promise<unknown>
  onRecolor: (id: string, color: string) => Promise<unknown>
  onDelete: (id: string) => Promise<unknown>
}) {
  const [name, setName] = useState(tag.name)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (fn: () => Promise<unknown>) => {
    setError(null)
    try {
      await fn()
    } catch {
      setError('That did not work — the name may already be taken.')
    }
  }

  const commitName = () => {
    const next = name.trim()
    if (next && next !== tag.name) run(() => onRename(tag.id, next))
    else setName(tag.name)
  }

  return (
    <div className="p-2">
      <button
        type="button"
        onClick={onBack}
        className="text-text-subtle mb-2 flex items-center gap-1 text-xs"
      >
        <ChevronLeft size={12} /> Back
      </button>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => e.key === 'Enter' && commitName()}
        className="h-8"
        maxLength={40}
        aria-label="Tag name"
      />
      <div className="mt-3 grid grid-cols-3 gap-1">
        {TAG_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => run(() => onRecolor(tag.id, c))}
            className="hover:bg-muted flex items-center gap-1.5 rounded-md px-1.5 py-1"
          >
            <span
              className={cn('size-3 rounded-sm', TAG_COLOR_CLASS[c])}
              aria-hidden
            />
            <span className="text-xs capitalize">{c}</span>
            {tag.color === c && <Check size={12} className="ml-auto" />}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() =>
          confirmDelete ? run(() => onDelete(tag.id)) : setConfirmDelete(true)
        }
        className="mt-3 w-full rounded-md px-2 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
      >
        {confirmDelete
          ? 'Confirm — removes it from every application'
          : 'Delete tag'}
      </button>
      {error && <p className="px-1 pt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
