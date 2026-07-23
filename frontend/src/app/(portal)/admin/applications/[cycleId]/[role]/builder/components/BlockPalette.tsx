'use client'

import type { QuestionType, Role } from '@/lib/api/types'
import { useCreateQuestion } from '@/lib/queries/questions'
import {
  DEFAULT_OPTIONS,
  QUESTION_TYPES,
  QUESTION_TYPE_META,
} from './constants'

export function BlockPalette({
  cycleId,
  role,
  nextOrder,
}: {
  cycleId: string
  role: Role
  nextOrder: number
}) {
  const createQuestion = useCreateQuestion()

  function handleAdd(type: QuestionType) {
    const meta = QUESTION_TYPE_META[type]
    createQuestion.mutate({
      cycleId,
      body: {
        role,
        question_text: 'Untitled question',
        question_type: type,
        is_required: true,
        display_order: nextOrder,
        options: meta.hasOptions ? DEFAULT_OPTIONS : undefined,
      },
    })
  }

  return (
    <div>
      <p className="text-text-subtle mb-2 px-3 text-xs font-medium tracking-wider uppercase">
        Add a block
      </p>
      <div className="flex flex-col gap-0.5">
        {QUESTION_TYPES.map((type) => {
          const meta = QUESTION_TYPE_META[type]
          const Icon = meta.icon
          return (
            <button
              key={type}
              type="button"
              onClick={() => handleAdd(type)}
              disabled={createQuestion.isPending}
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
