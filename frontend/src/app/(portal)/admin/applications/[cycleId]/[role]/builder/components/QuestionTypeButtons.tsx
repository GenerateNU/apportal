'use client'

import type { QuestionType } from '@/lib/api/types'
import { SectionLabel } from '@/components/ui/section-label'
import { QUESTION_TYPE_META } from './constants'

export function QuestionTypeButtons({
  types,
  onAdd,
  disabled,
  variant = 'list',
  title,
  hint,
}: {
  types: readonly QuestionType[]
  onAdd: (type: QuestionType) => void
  disabled?: boolean
  variant?: 'list' | 'start'
  title?: string
  hint?: string
}) {
  if (variant === 'start') {
    return (
      <div className="flex flex-col items-center gap-5 border border-gray-200 bg-white px-6 py-10 text-center">
        <div>
          <p className="text-ink text-lg font-semibold">{title}</p>
          {hint && <p className="text-text-muted text-sm">{hint}</p>}
        </div>
        <div className="grid w-full max-w-md grid-cols-2 gap-2 sm:grid-cols-3">
          {types.map((type) => {
            const meta = QUESTION_TYPE_META[type]
            const Icon = meta.icon
            return (
              <button
                key={type}
                type="button"
                onClick={() => onAdd(type)}
                disabled={disabled}
                className="hover:border-ink text-ink flex flex-col items-center gap-1.5 border border-gray-200 px-3 py-3 text-sm font-medium transition-colors hover:bg-gray-50 disabled:opacity-60"
              >
                <Icon className="text-text-subtle h-5 w-5" />
                {meta.label}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div>
      <SectionLabel as="p" className="mb-2 px-3">
        Add a block
      </SectionLabel>
      <div className="flex flex-col gap-0.5">
        {types.map((type) => {
          const meta = QUESTION_TYPE_META[type]
          const Icon = meta.icon
          return (
            <button
              key={type}
              type="button"
              onClick={() => onAdd(type)}
              disabled={disabled}
              className="text-text-secondary hover:text-text-default flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-base font-medium transition-colors hover:bg-gray-100 disabled:opacity-60"
            >
              <Icon className="text-text-subtle h-5 w-5 shrink-0" />
              {meta.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
