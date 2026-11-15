'use client'

import { useId } from 'react'
import type { InterviewRating } from '@/lib/api/types'
import { RATING_LABEL, RATING_OPTIONS } from '@/lib/interview-ratings'
import { cn } from '@/lib/utils'

export function RatingScale({
  value,
  onChange,
  disabled,
  invalid,
  label,
}: {
  value: InterviewRating | undefined
  onChange: (next: InterviewRating | undefined) => void
  disabled?: boolean
  invalid?: boolean
  label: string
}) {
  const id = useId()
  const selectedIndex = RATING_OPTIONS.findIndex((o) => o.value === value)

  function move(delta: number) {
    const from = selectedIndex === -1 ? (delta > 0 ? -1 : 1) : selectedIndex
    const next = Math.min(RATING_OPTIONS.length - 1, Math.max(0, from + delta))
    onChange(RATING_OPTIONS[next].value)
    document.getElementById(`${id}-${next}`)?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-invalid={invalid}
      className={cn(
        'grid w-full max-w-xl grid-cols-5 border',
        invalid ? 'border-destructive' : 'border-gray-300'
      )}
    >
      {RATING_OPTIONS.map((option, i) => {
        const selected = value === option.value
        return (
          <button
            key={option.value}
            id={`${id}-${i}`}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected || (selectedIndex === -1 && i === 0) ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(selected ? undefined : option.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault()
                move(1)
              }
              if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault()
                move(-1)
              }
            }}
            className={cn(
              'font-display min-h-10 px-1 py-2 text-xs leading-tight font-bold transition-colors not-last:border-r not-last:border-gray-200 disabled:cursor-default sm:text-sm',
              selected
                ? 'bg-ink text-white'
                : 'text-ink disabled:text-text-subtle hover:bg-gray-100 disabled:hover:bg-transparent'
            )}
          >
            {RATING_LABEL[option.value]}
          </button>
        )
      })}
    </div>
  )
}
