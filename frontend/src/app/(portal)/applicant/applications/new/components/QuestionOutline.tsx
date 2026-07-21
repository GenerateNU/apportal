'use client'

import type { Question } from '@/lib/api/types'

// A jump-to-question nav shown alongside the form so applicants can see all
// questions at a glance and scroll straight to one, rather than only
// scrolling linearly through a long form.
export function QuestionOutline({ questions }: { questions: Question[] }) {
  function handleSelect(id: string) {
    document
      .getElementById(`question-${id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  if (questions.length === 0) return null

  return (
    <nav className="flex flex-col gap-0.5">
      <p className="text-text-subtle mb-1 px-3 text-xs font-medium tracking-wider uppercase">
        Questions
      </p>
      {questions.map((question, index) => (
        <button
          key={question.id}
          type="button"
          onClick={() => handleSelect(question.id)}
          className="text-text-secondary hover:text-text-default flex items-start gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-gray-100"
        >
          <span className="text-text-faint w-4 shrink-0 text-xs font-medium">
            {index + 1}
          </span>
          <span className="truncate">
            {question.question_text || 'Untitled question'}
          </span>
        </button>
      ))}
    </nav>
  )
}
