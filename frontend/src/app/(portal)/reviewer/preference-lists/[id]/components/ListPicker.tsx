'use client'

import { ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// Same compact chrome as the filter button next to it — a full-height Select
// for a two-word value made the toolbar read as a form rather than a set of
// view controls.
export function ListPicker({
  label,
  value,
  options,
  onChange,
  ariaLabel,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  ariaLabel: string
}) {
  const current = options.find((o) => o.value === value)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className="text-text-muted inline-flex h-7 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 text-sm transition-colors hover:bg-gray-50"
        >
          <span className="text-text-faint">{label}</span>
          <span className="text-text-default font-medium">
            {current?.label ?? value}
          </span>
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
