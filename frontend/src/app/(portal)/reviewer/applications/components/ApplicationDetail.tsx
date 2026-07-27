'use client'
import { useRouter } from 'next/navigation'
import { ChevronsLeft, Maximize2 } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import type { ApplicantApplication } from './types'
import type { Question, WrittenAnswer } from '@/lib/api/types'
import { ResponseField } from './ResponseField'

export function ApplicationDetail({
  applicant,
  columns,
  rowQuestions,
  answers,
  onClose,
}: {
  applicant: ApplicantApplication
  columns: Question[]
  rowQuestions: Question[]
  answers: WrittenAnswer[]
  onClose: () => void
}) {
  const router = useRouter()

  const handleReview = () => {
    router.push(`/reviewer/my-reviews/${applicant.id}`)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="animate-in fade-in fixed inset-0 bg-black/30 duration-300"
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        className="animate-in slide-in-from-right-full fixed inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-gray-200 bg-white duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between py-2 pr-6 pl-2">
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-default flex items-center justify-center rounded-md px-1 py-1 transition-colors hover:bg-gray-100"
            aria-label="Close"
          >
            <ChevronsLeft className="h-5 w-5" />
          </button>
          <button
            onClick={handleReview}
            className="text-text-muted hover:text-text-default inline-flex items-center gap-1 text-sm transition-colors"
          >
            <Maximize2 className="h-3 w-3" />
            Review Applicant
          </button>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="px-6 py-6">
            {/* Header with avatar and name */}
            <div className="mb-8 flex items-start gap-4">
              <Avatar name={applicant.fullName} size="lg" />
              <div>
                <h1 className="text-text-default text-2xl font-semibold">
                  {applicant.fullName}
                </h1>
                <p className="text-text-muted mt-1 text-sm">
                  {applicant.email}
                </p>
              </div>
            </div>

            {/* Responses */}
            <div className="space-y-4">
              {columns.map((q) => {
                const rowQuestion = rowQuestions.find(
                  (rq) =>
                    rq.question_text.trim().toLowerCase() ===
                    q.question_text.trim().toLowerCase()
                )
                const answer = rowQuestion
                  ? answers.find((a) => a.question_id === rowQuestion.id)
                  : undefined

                return (
                  <ResponseField
                    key={q.id}
                    question={q}
                    answer={answer}
                    applicable={!!rowQuestion}
                  />
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
