'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ChiefVote, Role } from '@/lib/api/types'
import { useAnswers } from '@/lib/queries/answers'
import { useApplicant } from '@/lib/queries/applicants'
import {
  useApplication,
  useUpdateApplication,
} from '@/lib/queries/applications'
import {
  useChiefReviews,
  useUpsertChiefReview,
} from '@/lib/queries/chief-reviews'
import { useQuestions } from '@/lib/queries/questions'
import { useReviewQuestions } from '@/lib/queries/review-questions'
import { useCurrentUser } from '@/lib/queries/users'
import { useWrittenReviews } from '@/lib/queries/written-reviews'
import {
  CHIEF_VOTE_BADGE_CLASS,
  CHIEF_VOTE_LABEL,
  CHIEF_VOTE_ORDER,
} from '@/lib/chief-votes'
import { ROLE_LABEL } from '@/lib/roles'
import { ResponseField } from '@/app/(portal)/reviewer/applications/components/ResponseField'

export function ChiefReviewClient({
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
  const { data: application } = useApplication(applicationId)
  const { data: applicant } = useApplicant(applicantNuid)
  const { data: answers = [] } = useAnswers(applicationId)
  const { data: questions = [] } = useQuestions(cycleId, role)
  const { data: reviewQuestions = [] } = useReviewQuestions(cycleId, role)
  const { data: writtenReviews = [] } = useWrittenReviews(applicationId)
  const { data: chiefReviews = [] } = useChiefReviews(applicationId)
  const upsert = useUpsertChiefReview()
  const updateApplication = useUpdateApplication()

  const isChief = !!currentUser?.roles.some(
    (r) => r === 'chief' || r === 'admin'
  )

  const reviewQuestionById = useMemo(
    () => new Map(reviewQuestions.map((q) => [q.id, q])),
    [reviewQuestions]
  )

  // Applicant answers keyed by question id, for the read-only Application panel.
  const answersByQuestionId = useMemo(
    () => new Map(answers.map((a) => [a.question_id, a])),
    [answers]
  )

  const own = chiefReviews.find((r) => r.reviewer_nuid === currentUser?.nuid)
  const others = chiefReviews.filter(
    (r) => r.reviewer_nuid !== currentUser?.nuid
  )

  const [notes, setNotes] = useState('')
  const [vote, setVote] = useState<ChiefVote | undefined>(undefined)
  const [seeded, setSeeded] = useState(false)
  const [saved, setSaved] = useState(false)

  // Seed the form from this chief's existing review, once loaded.
  if (!seeded && chiefReviews) {
    setNotes(own?.notes ?? '')
    setVote(own?.vote)
    setSeeded(true)
  }

  // Only counts as "submitted" once there's an actual comment — casting a
  // vote alone isn't enough to say this chief has weighed in.
  const submitted = !!own?.notes?.trim()

  async function save() {
    setSaved(false)
    await upsert.mutateAsync({
      applicationId,
      body: { notes, vote },
    })
    setSaved(true)
  }

  function toggleVote(next: ChiefVote) {
    setVote((prev) => (prev === next ? undefined : next))
  }

  return (
    <div className="flex min-h-full flex-col lg:h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-white px-4 py-3 sm:px-8">
        <div className="flex items-center gap-4">
          <Link
            href="/reviewer/chief-review"
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
          <Link
            href={`/reviewer/my-reviews/${applicationId}`}
            className="text-text-muted hover:text-text-default text-sm underline-offset-2 hover:underline"
          >
            View lead review
          </Link>
          {submitted && (
            <span className="bg-status-open/15 text-status-open inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium">
              <Check size={12} />
              Review submitted
            </span>
          )}
        </div>
      </div>

      {/* Split: application (left) · lead reviews + vote (right) on desktop; stacked on mobile */}
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

        <div className="flex flex-col gap-8 px-4 py-4 sm:px-8 sm:py-6 lg:overflow-y-auto">
          {/* Lead written reviews */}
          <section>
            <h2 className="text-text-subtle mb-4 text-xs font-medium tracking-wider uppercase">
              Lead written reviews
            </h2>
            {writtenReviews.length === 0 ? (
              <p className="text-text-faint text-sm">
                No leads have submitted a written review yet.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {writtenReviews.map((r) => {
                  const scores = r.answers
                    .map((a) => a.score)
                    .filter((s): s is number => s != null)
                  const avg = scores.length
                    ? scores.reduce((a, b) => a + b, 0) / scores.length
                    : null
                  return (
                    <div
                      key={r.id}
                      className="rounded-xl border border-gray-100 bg-white p-4"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-text-default text-sm font-medium">
                          Reviewer {r.reviewer_name || r.reviewer_nuid}
                        </span>
                        <div className="flex items-center gap-2">
                          {avg != null && (
                            <span className="text-text-default rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium">
                              avg {avg.toFixed(1)}/10
                            </span>
                          )}
                          {!r.submitted_at && (
                            <span className="text-text-faint text-xs">
                              Draft — not submitted
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        {r.answers.map((a) => {
                          const q = reviewQuestionById.get(a.review_question_id)
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
                  )
                })}
              </div>
            )}
          </section>

          {/* This chief's vote */}
          <section>
            <h2 className="text-text-subtle mb-4 text-xs font-medium tracking-wider uppercase">
              Your vote
            </h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes on this applicant…"
              rows={5}
              className="focus:border-brand-blue text-text-default placeholder:text-text-subtle w-full rounded-md border border-gray-200 p-3 text-sm focus:outline-none"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {CHIEF_VOTE_ORDER.map((v) => (
                <Button
                  key={v}
                  variant={vote === v ? 'default' : 'outline'}
                  onClick={() => toggleVote(v)}
                >
                  {CHIEF_VOTE_LABEL[v]}
                </Button>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Button onClick={save} disabled={upsert.isPending}>
                {upsert.isPending ? (
                  <>
                    <Loader2 className="animate-spin" size={14} />
                    Saving…
                  </>
                ) : (
                  'Save'
                )}
              </Button>
              {saved && !upsert.isPending && (
                <span className="text-status-open inline-flex items-center gap-1 text-sm">
                  <Check size={14} />
                  Saved
                </span>
              )}
            </div>
          </section>

          {/* Other chiefs' votes */}
          {others.length > 0 && (
            <section>
              <h2 className="text-text-subtle mb-4 text-xs font-medium tracking-wider uppercase">
                Other chiefs&apos; votes
              </h2>
              <div className="flex flex-col gap-3">
                {others.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-gray-100 bg-white p-4"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-text-default text-sm font-medium">
                        {r.reviewer_name || r.reviewer_nuid}
                      </span>
                      {r.vote && (
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-medium ${CHIEF_VOTE_BADGE_CLASS[r.vote]}`}
                        >
                          {CHIEF_VOTE_LABEL[r.vote]}
                        </span>
                      )}
                    </div>
                    {r.notes && (
                      <p className="text-text-default text-sm whitespace-pre-wrap">
                        {r.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Final decision */}
          {isChief && (
            <section>
              <h2 className="text-text-subtle mb-4 text-xs font-medium tracking-wider uppercase">
                Final decision
              </h2>
              <p className="text-text-muted mb-3 text-sm">
                After discussing the votes above, advance this applicant to an
                interview or reject them. This changes the application&apos;s
                stage for everyone.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  disabled={
                    updateApplication.isPending ||
                    application?.stage === 'interview'
                  }
                  onClick={() =>
                    updateApplication.mutate({
                      id: applicationId,
                      body: { stage: 'interview' },
                    })
                  }
                >
                  {application?.stage === 'interview'
                    ? 'Advanced to interview'
                    : 'Advance to interview'}
                </Button>
                <Button
                  variant="outline"
                  disabled={
                    updateApplication.isPending ||
                    application?.stage === 'rejected'
                  }
                  onClick={() =>
                    updateApplication.mutate({
                      id: applicationId,
                      body: { stage: 'rejected' },
                    })
                  }
                >
                  {application?.stage === 'rejected' ? 'Rejected' : 'Reject'}
                </Button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
