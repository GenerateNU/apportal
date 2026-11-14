'use client'

import { Check, ChevronsUpDown, Tag as TagIcon } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { TagPill } from '@/components/ui/tag-select'
import type { CycleTag } from '@/lib/api/types'
import { cn } from '@/lib/utils'

// A multi-select over a cycle's tags, for narrowing a list to candidates
// carrying any of the chosen ones.
export function TagFilter({
  tags,
  value,
  onChange,
  className,
}: {
  tags: CycleTag[]
  value: string[]
  onChange: (ids: string[]) => void
  className?: string
}) {
  const toggle = (id: string) =>
    onChange(
      value.includes(id) ? value.filter((v) => v !== id) : [...value, id]
    )

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Filter by tag"
          className={cn(
            'border-input focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 items-center gap-2 rounded-lg border bg-transparent px-3 text-sm outline-none hover:border-gray-300 focus-visible:ring-3',
            className
          )}
        >
          <TagIcon size={14} className="text-text-faint shrink-0" />
          <span
            className={value.length ? 'text-text-default' : 'text-text-subtle'}
          >
            {value.length ? `Tags · ${value.length}` : 'All tags'}
          </span>
          <ChevronsUpDown size={14} className="text-text-faint shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1" align="start">
        <div className="max-h-64 overflow-y-auto">
          {tags.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => toggle(t.id)}
              className="hover:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left"
            >
              <Check
                size={14}
                className={value.includes(t.id) ? 'opacity-100' : 'opacity-0'}
              />
              <TagPill tag={t} />
            </button>
          ))}
        </div>
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-text-subtle hover:text-text-default mt-1 w-full rounded-md border-t border-gray-100 px-2 py-1.5 text-left text-xs"
          >
            Clear
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}
