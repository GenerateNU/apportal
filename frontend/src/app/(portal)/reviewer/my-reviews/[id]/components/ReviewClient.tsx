'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  Loader2,
  Lock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Role } from '@/lib/api/types'
import { useAnswers } from '@/lib/queries/answers'
import { useApplicant } from '@/lib/queries/applicants'
import { useApplicationTemplate } from '@/lib/queries/application-templates'
import { useApplications } from '@/lib/queries/applications'
import { useQuestions } from '@/lib/queries/questions'
import { useReviewQuestions } from '@/lib/queries/review-questions'
import { useCurrentUser } from '@/lib/queries/users'
import {
  useUpsertWrittenReview,
  useWrittenReviews,
  useWrittenReviewsByApplicationIds,
} from '@/lib/queries/written-reviews'
import { ROLE_CHIP_CLASS, ROLE_COLUMNS, ROLE_LABEL } from '@/lib/roles'
import { REVIEW_STATE_BADGE, REVIEWED_TEXT } from '../../constants'
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
  const router = useRouter()
  const { data: currentUser } = useCurrentUser()
  const { data: applicant } = useApplicant(applicantNuid)
  const { data: answers = [] } = useAnswers(applicationId)
  const { data: questions = [] } = useQuestions(cycleId, role)
  const { data: reviewQuestions = [] } = useReviewQuestions(cycleId, role)
  const { data: template } = useApplicationTemplate(cycleId, role)
  const { data: reviews = [] } = useWrittenReviews(applicationId)
  const upsert = useUpsertWrittenReview()

  // The rest of my review queue, so a "next" button can jump to the next
  // assigned application that still needs a review from me — same ordering
  // (grouped by role) as the queue page.
  const { data: assignedApplications = [] } = useApplications({
    assigned_to: currentUser?.nuid ?? '',
  })
  const orderedQueue = useMemo(
    () =>
      ROLE_COLUMNS.flatMap((r) =>
        assignedApplications.filter((a) => a.role === r)
      ),
    [assignedApplications]
  )
  const queueIds = useMemo(() => orderedQueue.map((a) => a.id), [orderedQueue])
  const queueReviewQueries = useWrittenReviewsByApplicationIds(queueIds)
  const needsReviewAt = useMemo(
    () => (i: number) => {
      const own = queueReviewQueries[i]?.data?.find(
        (r) => r.reviewer_nuid === currentUser?.nuid
      )
      return !own?.submitted_at
    },
    [queueReviewQueries, currentUser?.nuid]
  )
  const nextApplicationId = useMemo(() => {
    const currentIndex = orderedQueue.findIndex((a) => a.id === applicationId)
    if (currentIndex === -1) return null
    for (let i = currentIndex + 1; i < orderedQueue.length; i++) {
      if (needsReviewAt(i)) return orderedQueue[i].id
    }
    return null
  }, [orderedQueue, needsReviewAt, applicationId])
  const previousApplicationId = useMemo(() => {
    const currentIndex = orderedQueue.findIndex((a) => a.id === applicationId)
    if (currentIndex === -1) return null
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (needsReviewAt(i)) return orderedQueue[i].id
    }
    return null
  }, [orderedQueue, needsReviewAt, applicationId])

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

  // Score answers are stored as ints — a decimal would fail on the backend,
  // so block saving until it's fixed rather than surfacing a raw API error.
  function isInvalidScore(q: (typeof reviewQuestions)[number]) {
    if (q.question_type !== 'score') return false
    const text = reviewValues[q.id]?.text
    return !!text && !Number.isInteger(Number(text))
  }
  const hasInvalidScore = reviewQuestions.some(isInvalidScore)

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
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 sm:px-8">
        <div className="flex items-center gap-4">
          <Link
            href="/reviewer/my-reviews"
            className="text-text-muted hover:text-text-default inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft size={14} />
            Back to Lead review
          </Link>
          <div className="flex items-center gap-3 border-l border-gray-200 pl-4">
            <h1 className="text-text-default text-lg font-semibold">
              {applicant?.full_name ?? 'Applicant'}
            </h1>
            <span
              className={`w-fit rounded-md px-2 py-0.5 text-xs font-medium ${ROLE_CHIP_CLASS[role]}`}
            >
              {ROLE_LABEL[role]}
            </span>
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
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${REVIEW_STATE_BADGE.submitted}`}
            >
              <CheckCircle2 size={12} />
              Review submitted
            </span>
          )}
          {previousApplicationId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                router.push(`/reviewer/my-reviews/${previousApplicationId}`)
              }
            >
              <ChevronLeft data-icon="inline-start" size={14} />
              Previous application
            </Button>
          )}
          {nextApplicationId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                router.push(`/reviewer/my-reviews/${nextApplicationId}`)
              }
            >
              Next application
              <ArrowRight data-icon="inline-end" size={14} />
            </Button>
          )}
        </div>
      </div>

      {/* Split: application (left) · review (right) on desktop; stacked on mobile */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2 lg:overflow-hidden">
        {/* Application */}
        <div className="border-b border-gray-200 px-4 py-4 sm:px-8 sm:py-6 lg:overflow-y-auto lg:border-r lg:border-b-0">
          <h2 className="text-text-faint mb-4 text-xs font-semibold tracking-wide uppercase">
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
              className={`text-text-faint text-xs font-semibold tracking-wide uppercase ${template?.review_closes_at ? 'mb-1' : 'mb-4'}`}
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
            {submitted && (
              <div className="border-border bg-muted/40 text-text-muted mb-4 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm">
                <Lock size={14} />
                You&apos;ve submitted this review. You can still make changes
                below.
              </div>
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
                  <h3 className="text-text-faint mt-2 mb-3 text-xs font-semibold tracking-wide uppercase">
                    Other reviews
                  </h3>
                  <div className="flex flex-col gap-3">
                    {others.map((r) => (
                      <div
                        key={r.id}
                        className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                      >
                        <span className="text-text-muted text-xs">
                          Reviewer {r.reviewer_name || r.reviewer_nuid}
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
          <div className="flex flex-col items-stretch gap-3 border-t border-gray-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-8">
            {saved && !upsert.isPending && (
              <span
                className={`inline-flex items-center gap-1 text-sm sm:mr-auto ${REVIEWED_TEXT}`}
              >
                <Check size={14} />
                Saved
              </span>
            )}
            {submitted ? (
              <Button
                onClick={() => save(true)}
                disabled={upsert.isPending || hasInvalidScore}
                className="w-full sm:w-auto"
              >
                {upsert.isPending ? (
                  <>
                    <Loader2 className="animate-spin" size={14} />
                    Saving…
                  </>
                ) : (
                  'Save changes'
                )}
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => save(false)}
                  disabled={upsert.isPending || hasInvalidScore}
                  className="w-full sm:w-auto"
                >
                  Save draft
                </Button>
                <Button
                  onClick={() => save(true)}
                  disabled={
                    upsert.isPending || missingRequired || hasInvalidScore
                  }
                  className="w-full sm:w-auto"
                >
                  {upsert.isPending ? (
                    <>
                      <Loader2 className="animate-spin" size={14} />
                      Saving…
                    </>
                  ) : (
                    'Submit review'
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
