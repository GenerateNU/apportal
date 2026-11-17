'use client'

import { useSave } from './SaveTracker'
import type { QuestionType } from '@/lib/api/types'
import { useCreateQuestion } from '@/lib/queries/questions'
import {
  DEFAULT_OPTIONS,
  QUESTION_TYPES,
  QUESTION_TYPE_META,
} from './constants'
import { QuestionTypeButtons } from './QuestionTypeButtons'

export function BlockPalette({
  cycleId,
  role,
  nextOrder,
  variant,
  title,
  hint,
}: {
  cycleId: string
  role: string
  nextOrder: number
  variant?: 'list' | 'start'
  title?: string
  hint?: string
}) {
  const createQuestion = useCreateQuestion()
  const save = useSave()

  function handleAdd(type: QuestionType) {
    const meta = QUESTION_TYPE_META[type]
    save(createQuestion, {
      cycleId,
      body: {
        role_id: role,
        question_text: 'Untitled question',
        question_type: type,
        is_required: true,
        display_order: nextOrder,
        options: meta.hasOptions ? DEFAULT_OPTIONS : undefined,
      },
    })
  }

  return (
    <QuestionTypeButtons
      types={QUESTION_TYPES}
      onAdd={handleAdd}
      disabled={createQuestion.isPending}
      variant={variant}
      title={title}
      hint={hint}
    />
  )
}
