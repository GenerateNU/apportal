'use client'

import type { Question } from '@/lib/api/types'
import { QUESTION_TYPE_META } from './constants'

export function QuestionOutline({ questions }: { questions: Question[] }) {
  function handleSelect(id: string) {
    document
      .getElementById(`question-${id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div>
      <p className="text-text-subtle mb-2 px-3 text-xs font-medium tracking-wider uppercase">
        Questions
      </p>
      {questions.length === 0 ? (
        <p className="text-text-faint px-3 text-sm">No questions yet.</p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {questions.map((question, index) => {
            const Icon = QUESTION_TYPE_META[question.question_type].icon
            return (
              <button
                key={question.id}
                type="button"
                onClick={() => handleSelect(question.id)}
                className="text-text-secondary hover:text-text-default flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-gray-100"
              >
                <span className="text-text-faint w-4 shrink-0 text-xs font-medium">
                  {index + 1}
                </span>
                <Icon className="text-text-subtle h-4 w-4 shrink-0" />
                <span className="truncate">
                  {question.question_text || 'Untitled question'}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
