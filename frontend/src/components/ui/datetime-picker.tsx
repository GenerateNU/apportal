'use client'

import * as React from 'react'
import { Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

function to24Hour(hours12: number, meridiem: 'AM' | 'PM') {
  if (hours12 === 12) return meridiem === 'PM' ? 12 : 0
  return meridiem === 'PM' ? hours12 + 12 : hours12
}

function DateTimePicker({
  value,
  onValueChange,
  placeholder = 'Pick a date and time',
  disabled = false,
}: {
  value?: Date
  onValueChange: (date: Date) => void
  placeholder?: string
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  // Which month the grid shows. null follows `value`, which usually arrives
  // asynchronously — mirroring it into state would freeze the grid (and the
  // displayed time) on whatever was set before the fetch resolved.
  const [browsing, setBrowsing] = React.useState<Date | null>(null)
  // Raw input text, live only while a time field is being typed in; the
  // committed time always comes from `value`.
  const [hourDraft, setHourDraft] = React.useState<string | null>(null)
  const [minuteDraft, setMinuteDraft] = React.useState<string | null>(null)

  const month = browsing ?? new Date(value ?? new Date())

  const hours24 = value?.getHours() ?? 0
  const minutes = value?.getMinutes() ?? 0
  const hours12 = hours24 % 12 || 12
  const meridiem: 'AM' | 'PM' = hours24 >= 12 ? 'PM' : 'AM'

  // Each control edits one field of the current value and leaves the rest
  // alone. Seconds are always dropped — a deadline picked to the second is
  // noise the UI can't even show.
  const emit = (parts: { day?: number; hours?: number; minutes?: number }) => {
    const next = value ? new Date(value) : new Date()
    if (!value) next.setHours(0, 0, 0, 0)
    next.setSeconds(0, 0)
    if (parts.day !== undefined) {
      next.setFullYear(month.getFullYear(), month.getMonth(), parts.day)
    }
    if (parts.hours !== undefined) next.setHours(parts.hours)
    if (parts.minutes !== undefined) next.setMinutes(parts.minutes)
    onValueChange(next)
  }

  const commitHours = (raw: string) => {
    setHourDraft(null)
    const parsed = parseInt(raw)
    if (isNaN(parsed) || parsed < 1 || parsed > 12) return
    const next = to24Hour(parsed, meridiem)
    if (next !== hours24) emit({ hours: next })
  }

  const commitMinutes = (raw: string) => {
    setMinuteDraft(null)
    const parsed = parseInt(raw)
    if (isNaN(parsed) || parsed < 0 || parsed > 59) return
    if (parsed !== minutes) emit({ minutes: parsed })
  }

  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0
  ).getDate()
  const firstDayOfMonth = new Date(
    month.getFullYear(),
    month.getMonth(),
    1
  ).getDay()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const emptyDays = Array.from({ length: firstDayOfMonth }, (_, i) => i)

  const monthName = month.toLocaleString('default', { month: 'short' })
  const year = month.getFullYear()

  const formattedValue = value
    ? `${value.toLocaleDateString()} ${hours12}:${String(minutes).padStart(2, '0')} ${meridiem}`
    : ''

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setBrowsing(null)
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'justify-start text-left font-normal',
            !value && 'text-muted-foreground'
          )}
        >
          <Calendar className="mr-2 h-4 w-4" />
          {value ? formattedValue : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 max-w-[calc(100vw-2rem)] p-3"
        align="start"
      >
        <div className="space-y-3">
          {/* Month/Year Navigation */}
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() =>
                setBrowsing(new Date(month.getFullYear(), month.getMonth() - 1))
              }
              className="text-text-subtle hover:text-text-default rounded-md p-1.5 transition hover:bg-gray-100"
            >
              ←
            </button>
            <button
              onClick={() => setBrowsing(new Date())}
              className="text-text-default flex-1 rounded-md py-1 text-center text-sm font-medium transition hover:bg-gray-100"
            >
              {monthName} {year}
            </button>
            <button
              onClick={() =>
                setBrowsing(new Date(month.getFullYear(), month.getMonth() + 1))
              }
              className="text-text-subtle hover:text-text-default rounded-md p-1.5 transition hover:bg-gray-100"
            >
              →
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="space-y-2">
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-500">
              <div>S</div>
              <div>M</div>
              <div>T</div>
              <div>W</div>
              <div>T</div>
              <div>F</div>
              <div>S</div>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {emptyDays.map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {days.map((day) => {
                const isSelected =
                  value &&
                  value.getDate() === day &&
                  value.getMonth() === month.getMonth() &&
                  value.getFullYear() === month.getFullYear()
                const isToday =
                  new Date().getDate() === day &&
                  new Date().getMonth() === month.getMonth() &&
                  new Date().getFullYear() === month.getFullYear()
                return (
                  <button
                    key={day}
                    onClick={() => emit({ day })}
                    className={cn(
                      'text-text-default relative h-8 w-8 rounded-md text-sm font-medium transition-colors',
                      isSelected
                        ? 'bg-primary hover:bg-primary text-white'
                        : isToday
                          ? 'border-primary/30 border-2 hover:bg-gray-100'
                          : 'hover:bg-gray-100'
                    )}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Time Picker */}
          <div className="border-t border-gray-200 pt-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-gray-600">Time:</span>
              <div className="ml-auto flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={hourDraft ?? String(hours12).padStart(2, '0')}
                  onChange={(e) => setHourDraft(e.target.value)}
                  onBlur={(e) => commitHours(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  className="focus:border-primary focus:ring-primary/20 h-8 w-10 rounded-md border border-gray-300 text-center text-sm font-medium focus:ring-2 focus:outline-none"
                />
                <span className="font-medium text-gray-400">:</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={minuteDraft ?? String(minutes).padStart(2, '0')}
                  onChange={(e) => setMinuteDraft(e.target.value)}
                  onBlur={(e) => commitMinutes(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  className="focus:border-primary focus:ring-primary/20 h-8 w-10 rounded-md border border-gray-300 text-center text-sm font-medium focus:ring-2 focus:outline-none"
                />
                <div className="ml-1 flex gap-1">
                  {(['AM', 'PM'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        // Re-clicking the active half would emit an unchanged
                        // date — a write that saves nothing.
                        if (m !== meridiem)
                          emit({ hours: to24Hour(hours12, m) })
                      }}
                      className={cn(
                        'h-8 rounded-md px-2 text-xs font-medium transition',
                        meridiem === m
                          ? 'bg-primary text-white'
                          : 'border border-gray-300 text-gray-600 hover:bg-gray-100'
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { DateTimePicker }
