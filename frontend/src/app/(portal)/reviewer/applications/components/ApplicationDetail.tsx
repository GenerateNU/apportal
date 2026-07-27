'use client'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import type { ApplicantApplication } from './types'
import type { Question, WrittenAnswer } from '@/lib/api/types'
import { stageLabel } from './constants'
import { AnswerCell } from './AnswerCell'
import { formatDate } from '@/lib/utils'

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
        className="fixed inset-0 bg-black/30 animate-in fade-in duration-300"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-gray-200 bg-white animate-in slide-in-from-right-full duration-300">
        {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-6 py-4">
        <button
          onClick={onClose}
          className="text-text-muted hover:text-text-default rounded-md p-1.5 transition-colors hover:bg-gray-100"
          aria-label="Close"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={handleReview}
          className="text-brand-blue rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-blue-50"
        >
          Review Applicant
        </button>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-8 py-6">
          {/* Header with avatar and name */}
          <div className="mb-8 flex items-start gap-4">
            <Avatar name={applicant.fullName} size="lg" />
            <div>
              <h1 className="text-text-default text-2xl font-semibold">
                {applicant.fullName}
              </h1>
              <p className="text-text-muted mt-1 text-sm">{applicant.email}</p>
            </div>
          </div>

          {/* Properties */}
          <div className="space-y-4">
            {/* Stage */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-text-muted text-sm">Stage</p>
              </div>
              <div className="flex-1 text-right">
                <p className="text-text-default text-sm font-medium">
                  {stageLabel[applicant.stage]}
                </p>
              </div>
            </div>

            {/* Submitted */}
            <div className="flex items-start justify-between border-t border-gray-100 py-3">
              <div className="flex-1">
                <p className="text-text-muted text-sm">Submitted</p>
              </div>
              <div className="flex-1 text-right">
                <p className="text-text-default text-sm font-medium">
                  {formatDate(applicant.submittedAt)}
                </p>
              </div>
            </div>

            {/* Role */}
            <div className="flex items-start justify-between border-t border-gray-100 py-3">
              <div className="flex-1">
                <p className="text-text-muted text-sm">Role</p>
              </div>
              <div className="flex-1 text-right">
                <p className="text-text-default text-sm font-medium capitalize">
                  {applicant.role.replace('_', ' ')}
                </p>
              </div>
            </div>

            {/* Questions and answers */}
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
                <div
                  key={q.id}
                  className="flex items-start justify-between border-t border-gray-100 py-3"
                >
                  <div className="flex-1">
                    <p className="text-text-muted text-sm">{q.question_text}</p>
                  </div>
                  <div className="flex-1 text-right">
                    <div className="text-text-default inline-block text-sm">
                      <AnswerCell
                        answer={answer}
                        applicable={!!rowQuestion}
                        questionType={q.question_type}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      </div>
    </>
  )
}
