'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Role } from '@/lib/api/types'
import { useApplicant } from '@/lib/queries/applicants'
import {
  useChiefReviews,
  useUpsertChiefReview,
} from '@/lib/queries/chief-reviews'
import { useReviewQuestions } from '@/lib/queries/review-questions'
import { useCurrentUser } from '@/lib/queries/users'
import { useWrittenReviews } from '@/lib/queries/written-reviews'
import { ROLE_LABEL } from '@/lib/roles'

type Decision = 'advance' | 'hold'

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
  const { data: applicant } = useApplicant(applicantNuid)
  const { data: reviewQuestions = [] } = useReviewQuestions(cycleId, role)
  const { data: writtenReviews = [] } = useWrittenReviews(applicationId)
  const { data: chiefReviews = [] } = useChiefReviews(applicationId)
  const upsert = useUpsertChiefReview()

  const reviewQuestionById = useMemo(
    () => new Map(reviewQuestions.map((q) => [q.id, q])),
    [reviewQuestions]
  )

  const own = chiefReviews.find((r) => r.reviewer_nuid === currentUser?.nuid)
  const others = chiefReviews.filter(
    (r) => r.reviewer_nuid !== currentUser?.nuid
  )

  const [notes, setNotes] = useState('')
  const [decision, setDecision] = useState<Decision | undefined>(undefined)
  const [seeded, setSeeded] = useState(false)
  const [saved, setSaved] = useState(false)

  // Seed the form from this chief's existing decision, once loaded.
  if (!seeded && chiefReviews) {
    setNotes(own?.notes ?? '')
    setDecision(
      own?.advance_to_interview === true
        ? 'advance'
        : own?.advance_to_interview === false
          ? 'hold'
          : undefined
    )
    setSeeded(true)
  }

  async function save() {
    setSaved(false)
    await upsert.mutateAsync({
      applicationId,
      body: {
        notes,
        advance_to_interview:
          decision === 'advance' ? true : decision === 'hold' ? false : undefined,
      },
    })
    setSaved(true)
  }

  function toggleDecision(next: Decision) {
    setDecision((prev) => (prev === next ? undefined : next))
  }

  return (
    <div className="flex min-h-full flex-col">
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
        {own?.decided_at && (
          <span className="bg-status-open/15 text-status-open inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium">
            <Check size={12} />
            Decision recorded
          </span>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6 sm:px-8">
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
                        Reviewer {r.reviewer_nuid}
                      </span>
                      <div className="flex items-center gap-2">
                        {avg != null && (
                          <span className="bg-gray-100 text-text-default rounded-md px-2 py-0.5 text-xs font-medium">
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

        {/* This chief's decision */}
        <section>
          <h2 className="text-text-subtle mb-4 text-xs font-medium tracking-wider uppercase">
            Your decision
          </h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes on this applicant…"
            rows={5}
            className="focus:border-brand-blue text-text-default placeholder:text-text-subtle w-full rounded-md border border-gray-200 p-3 text-sm focus:outline-none"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant={decision === 'advance' ? 'default' : 'outline'}
              onClick={() => toggleDecision('advance')}
            >
              Advance to interview
            </Button>
            <Button
              variant={decision === 'hold' ? 'default' : 'outline'}
              onClick={() => toggleDecision('hold')}
            >
              Do not advance
            </Button>
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

        {/* Other chiefs' decisions */}
        {others.length > 0 && (
          <section>
            <h2 className="text-text-subtle mb-4 text-xs font-medium tracking-wider uppercase">
              Other chief decisions
            </h2>
            <div className="flex flex-col gap-3">
              {others.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-gray-100 bg-white p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-text-default text-sm font-medium">
                      Chief {r.reviewer_nuid}
                    </span>
                    {r.advance_to_interview != null && (
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                          r.advance_to_interview
                            ? 'bg-status-open/15 text-status-open'
                            : 'bg-gray-100 text-text-muted'
                        }`}
                      >
                        {r.advance_to_interview
                          ? 'Advance to interview'
                          : 'Do not advance'}
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
      </div>
    </div>
  )
}
