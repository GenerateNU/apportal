'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ANY_DAY, AVAILABILITY_OPTIONS, SKIP_DAY } from '@/lib/availability'

export function DaySelect({
  value,
  onChange,
  label,
  className = '',
}: {
  value: string
  onChange: (day: string) => void
  label: string
  className?: string
}) {
  return (
    <Select
      value={value || ANY_DAY}
      onValueChange={(v) => onChange(v === ANY_DAY ? '' : v)}
    >
      <SelectTrigger
        className={`h-8 w-40 text-xs ${className}`}
        aria-label={label}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY_DAY}>Any day</SelectItem>
        {AVAILABILITY_OPTIONS.map((opt) => (
          <SelectItem key={opt.key} value={opt.key}>
            {opt.label}
          </SelectItem>
        ))}
        <SelectItem value={SKIP_DAY}>Skip this run</SelectItem>
      </SelectContent>
    </Select>
  )
}
