'use client'

import { useSave } from './SaveTracker'
import type { QuestionType } from '@/lib/api/types'
import { useCreateReviewQuestion } from '@/lib/queries/review-questions'
import {
  DEFAULT_OPTIONS,
  REVIEW_QUESTION_TYPES,
  QUESTION_TYPE_META,
} from './constants'
import { QuestionTypeButtons } from './QuestionTypeButtons'

export function ReviewBlockPalette({
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
  const createReviewQuestion = useCreateReviewQuestion()
  const save = useSave()

  function handleAdd(type: QuestionType) {
    const meta = QUESTION_TYPE_META[type]
    save(createReviewQuestion, {
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
      types={REVIEW_QUESTION_TYPES}
      onAdd={handleAdd}
      disabled={createReviewQuestion.isPending}
      variant={variant}
      title={title}
      hint={hint}
    />
  )
}
