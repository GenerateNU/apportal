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
  const [month, setMonth] = React.useState<Date>(value || new Date())
  const [hours24, setHours24] = React.useState<number>(
    value ? value.getHours() : 0
  )
  const [minutes, setMinutes] = React.useState<string>(
    value ? String(value.getMinutes()).padStart(2, '0') : '00'
  )

  const hours12 = hours24 % 12 || 12
  const meridiem = hours24 >= 12 ? 'PM' : 'AM'

  const handleHourChange = (newHour12: number) => {
    const newHour24 =
      newHour12 === 12
        ? meridiem === 'PM'
          ? 12
          : 0
        : meridiem === 'PM'
          ? newHour12 + 12
          : newHour12
    setHours24(newHour24)

    const newDate = new Date(value || month)
    newDate.setHours(newHour24)
    newDate.setMinutes(parseInt(minutes) || 0)
    onValueChange(newDate)
  }

  const handleMeridiemChange = (newMeridiem: 'AM' | 'PM') => {
    let newHour24 = hours24
    if (newMeridiem === 'AM' && hours24 >= 12) {
      newHour24 = hours24 - 12
    } else if (newMeridiem === 'PM' && hours24 < 12) {
      newHour24 = hours24 + 12
    }
    setHours24(newHour24)

    const newDate = new Date(value || month)
    newDate.setHours(newHour24)
    newDate.setMinutes(parseInt(minutes) || 0)
    onValueChange(newDate)
  }

  const handleDateSelect = (day: number) => {
    const newDate = new Date(month)
    newDate.setDate(day)
    newDate.setHours(hours24)
    newDate.setMinutes(parseInt(minutes) || 0)
    onValueChange(newDate)
  }

  const handleMinutesChange = (newMinutes: string) => {
    const parsedMin = Math.min(59, Math.max(0, parseInt(newMinutes) || 0))
    setMinutes(String(parsedMin).padStart(2, '0'))

    const newDate = new Date(value || month)
    newDate.setHours(hours24)
    newDate.setMinutes(parsedMin)
    onValueChange(newDate)
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
    ? `${value.toLocaleDateString()} ${hours12}:${minutes} ${meridiem}`
    : ''

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1))
              }
              className="text-text-subtle hover:text-text-default rounded-md p-1.5 transition hover:bg-gray-100"
            >
              ←
            </button>
            <button
              onClick={() => setMonth(new Date())}
              className="text-text-default flex-1 rounded-md py-1 text-center text-sm font-medium transition hover:bg-gray-100"
            >
              {monthName} {year}
            </button>
            <button
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1))
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
                    onClick={() => handleDateSelect(day)}
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
                  value={String(hours12).padStart(2, '0')}
                  onChange={(e) => {
                    const val = e.target.value
                    const parsed = parseInt(val)
                    if (
                      val === '' ||
                      (!isNaN(parsed) && parsed >= 1 && parsed <= 12)
                    ) {
                      setHours24(
                        val === ''
                          ? 0
                          : parsed === 12
                            ? meridiem === 'PM'
                              ? 12
                              : 0
                            : meridiem === 'PM'
                              ? parsed + 12
                              : parsed
                      )
                    }
                  }}
                  onBlur={(e) => {
                    const val = e.target.value
                    const parsed = parseInt(val)
                    if (!isNaN(parsed) && parsed >= 1 && parsed <= 12) {
                      handleHourChange(parsed)
                    }
                  }}
                  className="focus:border-primary focus:ring-primary/20 h-8 w-10 rounded-md border border-gray-300 text-center text-sm font-medium focus:ring-2 focus:outline-none"
                />
                <span className="font-medium text-gray-400">:</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={minutes}
                  onChange={(e) => {
                    const val = e.target.value
                    if (
                      val === '' ||
                      (parseInt(val) >= 0 && parseInt(val) <= 59)
                    ) {
                      setMinutes(val)
                    }
                  }}
                  onBlur={(e) => {
                    const val = e.target.value
                    const parsed = parseInt(val)
                    if (!isNaN(parsed) && parsed >= 0 && parsed <= 59) {
                      handleMinutesChange(String(parsed).padStart(2, '0'))
                    }
                  }}
                  className="focus:border-primary focus:ring-primary/20 h-8 w-10 rounded-md border border-gray-300 text-center text-sm font-medium focus:ring-2 focus:outline-none"
                />
                <div className="ml-1 flex gap-1">
                  <button
                    onClick={() => handleMeridiemChange('AM')}
                    className={cn(
                      'h-8 rounded-md px-2 text-xs font-medium transition',
                      meridiem === 'AM'
                        ? 'bg-primary text-white'
                        : 'border border-gray-300 text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    AM
                  </button>
                  <button
                    onClick={() => handleMeridiemChange('PM')}
                    className={cn(
                      'h-8 rounded-md px-2 text-xs font-medium transition',
                      meridiem === 'PM'
                        ? 'bg-primary text-white'
                        : 'border border-gray-300 text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    PM
                  </button>
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
