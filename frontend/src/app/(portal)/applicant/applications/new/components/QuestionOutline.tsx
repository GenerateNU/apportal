'use client'

import type { ApplicationPage } from '@/lib/applicationPages'
import { cn } from '@/lib/utils'

// A jump-to-question nav shown alongside the form so applicants can see all
// questions at a glance and jump straight to one — across pages, not just
// within the current one.
export function QuestionOutline({
  pages,
  currentPageIndex,
  onNavigate,
}: {
  pages: ApplicationPage[]
  currentPageIndex: number
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
    <nav className="flex flex-col gap-0.5">
      <p className="text-text-subtle mb-1 px-3 text-xs font-medium tracking-wider uppercase">
        Questions
      </p>
      {rows.map((row) => (
        <div key={row.question.id}>
          {row.pageTitle && (
            <p className="text-text-faint mt-3 px-3 text-xs font-semibold first:mt-0">
              {row.pageTitle}
            </p>
          )}
          <button
            type="button"
            onClick={() => onNavigate(row.pageIndex, row.question.id)}
            className={cn(
              'text-text-secondary hover:text-text-default flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-gray-100',
              row.pageIndex === currentPageIndex && 'bg-gray-100'
            )}
          >
            <span className="text-text-faint w-4 shrink-0 text-xs font-medium">
              {row.number + 1}
            </span>
            <span className="truncate">
              {row.question.question_text || 'Untitled question'}
            </span>
          </button>
        </div>
      ))}
    </nav>
  )
}
