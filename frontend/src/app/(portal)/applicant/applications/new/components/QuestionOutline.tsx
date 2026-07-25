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
            <p className="text-text-default mb-3 mt-6 px-3 text-xs font-semibold first:mt-0">
              {row.pageTitle}
            </p>
          )}
          <button
            type="button"
            onClick={() => onNavigate(row.pageIndex, row.question.id)}
            className={cn(
              'text-text-secondary hover:text-text-default mb-2 flex w-full items-start gap-2.5 rounded-md px-3 py-2.5 text-left text-sm transition-all duration-200 hover:bg-blue-50 select-none',
              row.question.id === selectedQuestionId && 'bg-blue-50 text-brand-blue font-medium'
            )}
          >
            <span
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold pointer-events-none transition-all duration-200',
                row.question.id === selectedQuestionId
                  ? 'bg-brand-blue text-white scale-105'
                  : 'bg-gray-200 text-text-default'
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
