'use client'

import type { QuestionType, Role } from '@/lib/api/types'
import { useCreateQuestion } from '@/lib/queries/questions'
import { REVIEWER_ACTOR } from '@/lib/stub-actor'
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
      opts: { actor: REVIEWER_ACTOR },
    })
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <p className="text-text-default mb-2 border-b border-gray-200 px-1 pb-2 text-xs font-semibold tracking-wider uppercase">
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
              className="text-text-secondary hover:text-text-default flex items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-sm font-medium transition-colors hover:bg-gray-100 disabled:opacity-60"
            >
              <Icon className="text-text-subtle h-4 w-4 shrink-0" />
              {meta.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
