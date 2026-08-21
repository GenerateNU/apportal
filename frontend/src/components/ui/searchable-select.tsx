'use client'

import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface SearchableSelectOption {
  value: string
  label: string
}

// A filterable dropdown for option lists too long to scan by eye (e.g.
// picking one applicant out of a whole cycle's pool) — the plain Select in
// components/ui/select.tsx has no search, so this is a separate primitive
// rather than a variant of it.
export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No results.',
  className,
  ariaLabel,
}: {
  options: SearchableSelectOption[]
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
  ariaLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? options.filter((o) =>
        o.label.toLowerCase().includes(query.trim().toLowerCase())
      )
    : options

  const selected = options.find((o) => o.value === value)

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery('')
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className={cn(
            'border-input focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 items-center justify-between gap-2 rounded-lg border bg-transparent px-3 py-2 text-sm outline-none hover:border-gray-300 focus-visible:ring-3',
            className
          )}
        >
          <span
            className={cn(
              'truncate',
              selected ? 'text-text-default' : 'text-text-subtle'
            )}
          >
            {selected?.label ?? placeholder}
          </span>
          <ChevronsUpDown size={14} className="text-text-faint shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="border-b border-gray-100 p-2">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="text-text-faint px-2 py-1.5 text-sm">{emptyText}</p>
          ) : (
            filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onValueChange(o.value)
                  setOpen(false)
                  setQuery('')
                }}
                className="hover:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm"
              >
                <Check
                  size={14}
                  className={o.value === value ? 'opacity-100' : 'opacity-0'}
                />
                <span className="truncate">{o.label}</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
