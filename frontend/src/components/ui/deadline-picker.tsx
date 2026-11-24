'use client'

import { CalendarClock, ChevronDown, Plus } from 'lucide-react'
import { Tooltip } from '@/components/Tooltip'
import { DateTimePicker } from '@/components/ui/datetime-picker'
import { formatDeadline, timeLeft } from '@/lib/deadline'
import { cn } from '@/lib/utils'

export function DeadlinePicker({
  value,
  onValueChange,
  disabled,
  lockedReason,
}: {
  value?: string
  onValueChange: (date: Date) => void
  disabled?: boolean
  lockedReason?: string
}) {
  const date = value ? new Date(value) : undefined
  const left = date ? timeLeft(date) : undefined
  const picker = (
    <DateTimePicker
      value={date}
      onValueChange={onValueChange}
      disabled={disabled || !!lockedReason}
      trigger={
        <button
          type="button"
          disabled={disabled || !!lockedReason}
          className={cn(
            'hover:border-ink flex items-center gap-2 border bg-white px-2.5 py-1.5 text-left transition-colors disabled:opacity-60',
            date ? 'border-gray-300' : 'border-dashed border-gray-300'
          )}
        >
          {date && left ? (
            <>
              <CalendarClock size={16} className="text-text-subtle shrink-0" />
              <span className="flex flex-col">
                <span className="text-ink text-sm">{formatDeadline(date)}</span>
                <span
                  className={cn(
                    'text-xs',
                    left.passed
                      ? 'text-text-subtle'
                      : left.soon
                        ? 'font-medium text-amber-600'
                        : 'text-text-muted'
                  )}
                >
                  {left.text}
                  {left.passed && !lockedReason && (
                    <span className="text-ink ml-2 font-medium">Extend</span>
                  )}
                </span>
              </span>
              <ChevronDown
                size={14}
                className="text-text-subtle ml-1 shrink-0"
              />
            </>
          ) : (
            <>
              <Plus size={14} className="text-text-subtle shrink-0" />
              <span className="text-text-muted text-sm">Set deadline</span>
            </>
          )}
        </button>
      }
    />
  )
  return lockedReason ? (
    <Tooltip label={lockedReason}>{picker}</Tooltip>
  ) : (
    picker
  )
}
