'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Role } from '@/lib/api/types'
import { useAnswers } from '@/lib/queries/answers'
import { useApplicant } from '@/lib/queries/applicants'
import { useApplicationTemplate } from '@/lib/queries/application-templates'
import { useQuestions } from '@/lib/queries/questions'
import { useReviewQuestions } from '@/lib/queries/review-questions'
import { useCurrentUser } from '@/lib/queries/users'
import {
  useUpsertWrittenReview,
  useWrittenReviews,
} from '@/lib/queries/written-reviews'
import { ROLE_LABEL } from '@/lib/roles'
import { ResponseField } from '@/app/(portal)/reviewer/applications/components/ResponseField'
import {
  QuestionField,
  type AnswerValue,
} from '@/app/(portal)/applicant/applications/components/QuestionField'

export function ReviewClient({
  applicationId,
  cycleId,
  role,
  applicantNuid,
}: {
  applicationId: string
  cycleId: string
  role: Role
  applicantNuid: string
}) {
  const { data: currentUser } = useCurrentUser()
  const { data: applicant } = useApplicant(applicantNuid)
  const { data: answers = [] } = useAnswers(applicationId)
  const { data: questions = [] } = useQuestions(cycleId, role)
  const { data: reviewQuestions = [] } = useReviewQuestions(cycleId, role)
  const { data: template } = useApplicationTemplate(cycleId, role)
  const { data: reviews = [] } = useWrittenReviews(applicationId)
  const upsert = useUpsertWrittenReview()

  const isChief = !!currentUser?.roles.some(
    (r) => r === 'chief' || r === 'admin'
  )

  const reviewQuestionById = useMemo(
    () => new Map(reviewQuestions.map((q) => [q.id, q])),
    [reviewQuestions]
  )

  const own = reviews.find((r) => r.reviewer_nuid === currentUser?.nuid)
  const others = reviews.filter((r) => r.reviewer_nuid !== currentUser?.nuid)

  // Applicant answers keyed by question id, for the read-only left panel.
  const answersByQuestionId = useMemo(
    () => new Map(answers.map((a) => [a.question_id, a])),
    [answers]
  )

  const [reviewValues, setReviewValues] = useState<Record<string, AnswerValue>>(
    {}
  )
  const [seeded, setSeeded] = useState(false)
  const [saved, setSaved] = useState(false)

  // Seed the form from the reviewer's existing review, once loaded.
  if (!seeded && reviews) {
    const seededValues: Record<string, AnswerValue> = {}
    for (const a of own?.answers ?? []) {
      if (a.score != null) {
        seededValues[a.review_question_id] = { text: String(a.score) }
      } else if (a.answer_options?.length) {
        seededValues[a.review_question_id] = { options: a.answer_options }
      } else {
        seededValues[a.review_question_id] = { text: a.answer_text ?? '' }
      }
    }
    setReviewValues(seededValues)
    setSeeded(true)
  }

  const submitted = !!own?.submitted_at

  function isMissing(q: (typeof reviewQuestions)[number]) {
    if (!q.is_required) return false
    const v = reviewValues[q.id]
    if (q.question_type === 'checkbox') return !v?.options?.length
    return !v?.text?.trim()
  }
  const missingRequired = reviewQuestions.some(isMissing)

  async function save(submit: boolean) {
    setSaved(false)

    // Always send one entry per review question (not just the answered
    // ones) — a question that was cleared needs to actually clear the
    // stored answer, not leave the stale value in place.
    const reviewAnswers = reviewQuestions.map((q) => {
      const v = reviewValues[q.id]
      if (q.question_type === 'checkbox') {
        return { review_question_id: q.id, answer_options: v?.options ?? [] }
      }
      if (q.question_type === 'score') {
        return {
          review_question_id: q.id,
          score: v?.text ? Number(v.text) : undefined,
        }
      }
      return { review_question_id: q.id, answer_text: v?.text ?? '' }
    })

    await upsert.mutateAsync({
      applicationId,
      body: {
        submit,
        answers: reviewAnswers,
      },
    })
    setSaved(true)
  }

  function updateReviewValue(id: string, next: AnswerValue) {
    setReviewValues((prev) => ({ ...prev, [id]: next }))
  }

  return (
    <div className="flex min-h-full flex-col lg:h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-white px-4 py-3 sm:px-8">
        <div className="flex items-center gap-4">
          <Link
            href="/reviewer/my-reviews"
            className="text-text-muted hover:text-text-default inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft size={14} />
            Queue
          </Link>
          <div className="border-l border-gray-100 pl-4">
            <h1 className="text-text-default text-base font-semibold">
              {applicant?.full_name ?? 'Applicant'}
            </h1>
            <p className="text-text-muted text-xs">{ROLE_LABEL[role]}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isChief && (
            <Link
              href={`/reviewer/chief-review/${applicationId}`}
              className="text-text-muted hover:text-text-default text-sm underline-offset-2 hover:underline"
            >
              Chief review
            </Link>
          )}
          {submitted && (
            <span className="bg-status-open/15 text-status-open inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium">
              <Check size={12} />
              Review submitted
            </span>
          )}
        </div>
      </div>

      {/* Split: application (left) · review (right) on desktop; stacked on mobile */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2 lg:overflow-hidden">
        {/* Application */}
        <div className="border-b border-gray-100 px-4 py-4 sm:px-8 sm:py-6 lg:overflow-y-auto lg:border-r lg:border-b-0">
          <h2 className="text-text-subtle mb-4 text-xs font-medium tracking-wider uppercase">
            Application
          </h2>
          <div className="space-y-4">
            {questions.map((q) => (
              <ResponseField
                key={q.id}
                question={q}
                answer={answersByQuestionId.get(q.id)}
                applicable={true}
              />
            ))}
          </div>
        </div>

        {/* Review */}
        <div className="lg:flex lg:min-h-0 lg:flex-col">
          <div className="px-4 py-4 sm:px-8 sm:py-6 lg:flex-1 lg:overflow-y-auto">
            <h2
              className={`text-text-subtle text-xs font-medium tracking-wider uppercase ${template?.review_closes_at ? 'mb-1' : 'mb-4'}`}
            >
              Your review
            </h2>
            {template?.review_closes_at && (
              <p className="text-text-muted mb-4 text-xs">
                Reviews are due by{' '}
                {new Date(template.review_closes_at).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
                . You can still save and submit after this — it&apos;s just a
                target.
              </p>
            )}
            <div className="flex flex-col gap-4">
              {reviewQuestions.length === 0 ? (
                <p className="text-text-faint text-sm">
                  No review questions have been set up for this cycle/role yet.
                </p>
              ) : (
                reviewQuestions.map((q, i) => (
                  <QuestionField
                    key={q.id}
                    question={q}
                    index={i}
                    value={reviewValues[q.id] ?? {}}
                    onChange={(next) => updateReviewValue(q.id, next)}
                  />
                ))
              )}

              {others.length > 0 && (
                <div>
                  <h3 className="text-text-default mt-2 mb-3 text-sm font-semibold">
                    Other reviews
                  </h3>
                  <div className="flex flex-col gap-3">
                    {others.map((r) => (
                      <div
                        key={r.id}
                        className="rounded-xl border border-gray-100 bg-white p-4"
                      >
                        <span className="text-text-muted text-xs">
                          Reviewer {r.reviewer_nuid}
                        </span>
                        <div className="mt-2 flex flex-col gap-2">
                          {r.answers.map((a) => {
                            const q = reviewQuestionById.get(
                              a.review_question_id
                            )
                            const display =
                              a.score != null
                                ? `${a.score}/10`
                                : a.answer_options?.length
                                  ? a.answer_options.join(', ')
                                  : a.answer_text
                            if (!display) return null
                            return (
                              <div key={a.id}>
                                <p className="text-text-muted text-xs font-medium">
                                  {q?.question_text ?? 'Question'}
                                </p>
                                <p className="text-text-default text-sm whitespace-pre-wrap">
                                  {display}
                                </p>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action footer */}
          <div className="flex flex-col items-stretch gap-3 border-t border-gray-100 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-8">
            {saved && !upsert.isPending && (
              <span className="text-status-open inline-flex items-center gap-1 text-sm sm:mr-auto">
                <Check size={14} />
                Saved
              </span>
            )}
            <Button
              variant="outline"
              onClick={() => save(false)}
              disabled={upsert.isPending}
              className="w-full sm:w-auto"
            >
              Save draft
            </Button>
            <Button
              onClick={() => save(true)}
              disabled={upsert.isPending || missingRequired}
              className="w-full sm:w-auto"
            >
              {upsert.isPending ? (
                <>
                  <Loader2 className="animate-spin" size={14} />
                  Saving…
                </>
              ) : submitted ? (
                'Update review'
              ) : (
                'Submit review'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
