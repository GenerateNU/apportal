'use client'

import type { ApplicationPage } from '@/lib/applicationPages'
import { cn } from '@/lib/utils'

// A jump-to-question nav shown alongside the form so applicants can see all
// questions at a glance and jump straight to one — across pages, not just
// within the current one.
export function QuestionOutline({
  pages,
  currentPageIndex,
  selectedQuestionId,
  onNavigate,
}: {
  pages: ApplicationPage[]
  currentPageIndex: number
  selectedQuestionId: string | null
  onNavigate: (pageIndex: number, questionId: string) => void
}) {
  let number = 0
  const rows = pages.flatMap((page, pageIndex) =>
    page.questions.map((question, i) => ({
      pageIndex,
      question,
      number: number++,
      pageTitle: i === 0 ? page.title : null,
    }))
  )

  if (rows.length === 0) return null

  return (
    <nav className="flex flex-col gap-0 select-none">
      <p className="text-text-subtle mb-4 px-3 text-xs font-medium tracking-wider uppercase">
        Questions
      </p>
      {rows.map((row, idx) => (
        <div key={row.question.id}>
          {row.pageTitle && (
            <p className="text-text-default mt-6 mb-3 px-3 text-xs font-semibold first:mt-0">
              {row.pageTitle}
            </p>
          )}
          <button
            type="button"
            onClick={() => onNavigate(row.pageIndex, row.question.id)}
            className={cn(
              'text-text-secondary hover:text-text-default mb-2 flex w-full items-start gap-2.5 rounded-md px-3 py-2.5 text-left text-sm transition-all duration-200 select-none hover:bg-blue-50',
              row.question.id === selectedQuestionId &&
                'text-brand-blue bg-blue-50 font-medium'
            )}
          >
            <span
              className={cn(
                'pointer-events-none flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold transition-all duration-200',
                row.question.id === selectedQuestionId
                  ? 'bg-brand-blue scale-105 text-white'
                  : 'text-text-default bg-gray-200'
              )}
            >
              {row.number + 1}
            </span>
            <span className="pointer-events-none flex-1 truncate text-sm">
              {row.question.question_text || 'Untitled question'}
            </span>
          </button>
        </div>
      ))}
    </nav>
  )
}
