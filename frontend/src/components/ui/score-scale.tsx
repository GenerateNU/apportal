'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'

export function ScoreScale({
  value,
  onChange,
  disabled,
  invalid,
  label,
  min = 1,
  max = 10,
}: {
  value: number | undefined
  onChange: (next: number | undefined) => void
  disabled?: boolean
  invalid?: boolean
  label: string
  min?: number
  max?: number
}) {
  const id = useId()
  const scores = Array.from({ length: max - min + 1 }, (_, i) => i + min)

  function move(from: number, delta: number) {
    const next = Math.min(max, Math.max(min, from + delta))
    onChange(next)
    document.getElementById(`${id}-${next}`)?.focus()
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="radiogroup"
        aria-label={label}
        aria-invalid={invalid}
        className={cn(
          'grid w-full max-w-md border',
          invalid ? 'border-destructive' : 'border-gray-300'
        )}
        style={{
          gridTemplateColumns: `repeat(${scores.length}, minmax(0, 1fr))`,
        }}
      >
        {scores.map((score) => {
          const selected = value === score
          return (
            <button
              key={score}
              id={`${id}-${score}`}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected || (!value && score === min) ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(selected ? undefined : score)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                  e.preventDefault()
                  move(value ?? min - 1, 1)
                }
                if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                  e.preventDefault()
                  move(value ?? min + 1, -1)
                }
              }}
              className={cn(
                'font-display h-10 text-sm font-bold transition-colors not-last:border-r not-last:border-gray-200 disabled:cursor-default',
                selected
                  ? 'bg-ink text-white'
                  : 'text-ink disabled:text-text-subtle hover:bg-gray-100 disabled:hover:bg-transparent'
              )}
            >
              {score}
            </button>
          )
        })}
      </div>
      <div className="text-text-subtle flex w-full max-w-md justify-between text-[11px]">
        <span>Weak</span>
        <span>Solid</span>
        <span>Exceptional</span>
      </div>
    </div>
  )
}
