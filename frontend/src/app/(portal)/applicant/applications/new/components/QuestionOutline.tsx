'use client'

import type { Question } from '@/lib/api/types'
import type { ApplicationPage } from '@/lib/applicationPages'
import { Check, Lock, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SectionLabel } from '@/components/ui/section-label'

// A jump-to-question nav shown alongside the form so applicants can see all
// questions at a glance and jump straight to one — across pages, not just
// within the current one.
export function QuestionOutline({
  pages,
  selectedQuestionId,
  unlockedThrough,
  problemIds,
  answeredIds,
  challengeName,
  onNavigate,
}: {
  pages: ApplicationPage<Question>[]
  selectedQuestionId: string | null
  unlockedThrough: number
  problemIds: Set<string>
  answeredIds: Set<string>
  challengeName?: string
  onNavigate: (pageIndex: number, questionId: string) => void
}) {
  let number = 0
  const rows: {
    pageIndex: number
    question: Pick<Question, 'id' | 'question_text'>
    number: number
    pageTitle: string | null
    isChallenge?: boolean
  }[] = pages.flatMap((page, pageIndex) =>
    page.questions.map((question, i) => ({
      pageIndex,
      question,
      number: number++,
      pageTitle:
        i === 0 && page.title !== pages[pageIndex - 1]?.title
          ? page.title
          : null,
    }))
  )
  if (challengeName && pages.length > 0) {
    rows.push({
      pageIndex: pages.length,
      question: { id: 'challenge', question_text: challengeName },
      number: number++,
      pageTitle: 'Challenge',
      isChallenge: true,
    })
  }

  if (rows.length === 0) return null

  return (
    <nav className="flex flex-col gap-0 select-none">
      <SectionLabel as="p" className="mb-4 px-3">
        Questions
      </SectionLabel>
      {rows.map((row) => (
        <div key={row.question.id}>
          {row.pageTitle && (
            <p className="text-text-default mt-6 mb-3 px-3 text-xs font-semibold first:mt-0">
              {row.pageTitle}
            </p>
          )}
          <button
            type="button"
            disabled={row.number > unlockedThrough}
            title={
              row.number > unlockedThrough
                ? 'Answer the required questions before this one first'
                : undefined
            }
            onClick={() => onNavigate(row.pageIndex, row.question.id)}
            className={cn(
              'text-text-secondary hover:text-ink mb-1 flex w-full items-start gap-2.5 px-3 py-2 text-left text-sm transition-colors select-none hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent',
              row.question.id === selectedQuestionId &&
                'text-ink bg-gray-100 font-medium'
            )}
          >
            <span
              className={cn(
                'font-display pointer-events-none flex h-6 w-6 shrink-0 items-center justify-center text-[11px] font-bold transition-colors',
                problemIds.has(row.question.id)
                  ? 'bg-destructive text-white'
                  : row.question.id === selectedQuestionId
                    ? 'bg-ink text-white'
                    : answeredIds.has(row.question.id)
                      ? 'text-ink bg-gray-200'
                      : 'text-text-muted bg-gray-100'
              )}
            >
              {answeredIds.has(row.question.id) &&
              !problemIds.has(row.question.id) ? (
                <Check size={13} strokeWidth={3} aria-label="Answered" />
              ) : row.isChallenge ? (
                '</>'
              ) : (
                row.number + 1
              )}
            </span>
            <span className="pointer-events-none flex-1 truncate text-sm">
              {row.question.question_text || 'Untitled question'}
            </span>
            {problemIds.has(row.question.id) && (
              <X
                size={14}
                strokeWidth={3}
                aria-label="Needs fixing"
                className="text-destructive mt-0.5 shrink-0"
              />
            )}
            {row.number > unlockedThrough && (
              <Lock size={12} className="text-text-faint mt-1 shrink-0" />
            )}
          </button>
        </div>
      ))}
    </nav>
  )
}
