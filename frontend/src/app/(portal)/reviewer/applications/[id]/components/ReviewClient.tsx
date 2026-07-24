'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Role } from '@/lib/api/types'
import { useAnswers } from '@/lib/queries/answers'
import { useApplicant } from '@/lib/queries/applicants'
import { useApplication } from '@/lib/queries/applications'
import { useChallenges } from '@/lib/queries/challenges'
import { useQuestions } from '@/lib/queries/questions'
import { useSubmission } from '@/lib/queries/submissions'
import { useCurrentUser } from '@/lib/queries/users'
import {
  useUpsertWrittenReview,
  useWrittenReviews,
} from '@/lib/queries/written-reviews'
import { ROLE_LABEL } from '@/lib/roles'
import { ApplicationFields } from '@/app/(portal)/applicant/applications/components/ApplicationFields'
import type { AnswerValue } from '@/app/(portal)/applicant/applications/components/QuestionField'

const TEXTAREA_CLASS =
  'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 min-h-24 w-full rounded-lg border bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:ring-3'

type ScoreEntry = { score: string; comment: string }

const noop = () => {}

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
  const { data: application } = useApplication(applicationId)
  const { data: answers = [] } = useAnswers(applicationId)
  const { data: questions = [] } = useQuestions(cycleId, role)
  const { data: challenges = [] } = useChallenges(cycleId, role)
  const { data: submission } = useSubmission(applicationId)
  const { data: reviews = [] } = useWrittenReviews(applicationId)
  const upsert = useUpsertWrittenReview()

  const own = reviews.find((r) => r.reviewer_nuid === currentUser?.nuid)
  const others = reviews.filter((r) => r.reviewer_nuid !== currentUser?.nuid)

  // Applicant answers, ordered by their question's display order.
  const questionById = useMemo(
    () => new Map(questions.map((q) => [q.id, q])),
    [questions]
  )
  const orderedAnswers = useMemo(
    () =>
      [...answers].sort(
        (a, b) =>
          (questionById.get(a.question_id)?.display_order ?? 0) -
          (questionById.get(b.question_id)?.display_order ?? 0)
      ),
    [answers, questionById]
  )

  // Answer values keyed by question id, in the shape ApplicationFields expects.
  const values = useMemo(() => {
    const map: Record<string, AnswerValue> = {}
    for (const answer of answers) {
      const opts = answer.answer_options
      map[answer.question_id] = Array.isArray(opts)
        ? { options: opts as string[] }
        : { text: answer.answer_text ?? '' }
    }
    return map
  }, [answers])

  const [scores, setScores] = useState<Record<string, ScoreEntry>>({})
  const [overall, setOverall] = useState('')
  const [reasoning, setReasoning] = useState('')
  const [seeded, setSeeded] = useState(false)
  const [saved, setSaved] = useState(false)

  // Seed the form from the reviewer's existing review, once loaded.
  if (!seeded && reviews) {
    const seededScores: Record<string, ScoreEntry> = {}
    for (const s of own?.answer_scores ?? []) {
      seededScores[s.answer_id] = {
        score: s.score != null ? String(s.score) : '',
        comment: s.comment ?? '',
      }
    }
    setScores(seededScores)
    setOverall(own?.overall_score != null ? String(own.overall_score) : '')
    setReasoning(own?.reasoning ?? '')
    setSeeded(true)
  }

  const submitted = !!own?.submitted_at

  async function save(submit: boolean) {
    setSaved(false)
    const answerScores = orderedAnswers
      .map((a) => {
        const entry = scores[a.id]
        const score = entry?.score ? Number(entry.score) : undefined
        const comment = entry?.comment?.trim() || undefined
        if (score === undefined && !comment) return null
        return { answer_id: a.id, score, comment }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    await upsert.mutateAsync({
      applicationId,
      body: {
        overall_score: overall ? Number(overall) : undefined,
        reasoning: reasoning.trim() || undefined,
        submit,
        answer_scores: answerScores,
      },
    })
    setSaved(true)
  }

  function setScore(answerId: string, patch: Partial<ScoreEntry>) {
    setScores((prev) => {
      const current = prev[answerId] ?? { score: '', comment: '' }
      return { ...prev, [answerId]: { ...current, ...patch } }
    })
  }

  return (
    <div className="flex min-h-full flex-col lg:h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-white px-4 py-3 sm:px-8">
        <div className="flex items-center gap-4">
          <Link
            href="/reviewer/applications"
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
        {submitted && (
          <span className="bg-status-open/15 text-status-open inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium">
            <Check size={12} />
            Review submitted
          </span>
        )}
      </div>

      {/* Split: application (left) · review (right) on desktop; stacked on mobile */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2 lg:overflow-hidden">
        {/* Application */}
        <div className="border-b border-gray-100 px-4 py-4 sm:px-8 sm:py-6 lg:overflow-y-auto lg:border-r lg:border-b-0">
          <h2 className="text-text-subtle mb-4 text-xs font-medium tracking-wider uppercase">
            Application
          </h2>
          <ApplicationFields
            questions={questions}
            challenge={challenges[0]}
            values={values}
            onValueChange={noop}
            resumeUrl={application?.resume_url ?? ''}
            onResumeChange={noop}
            availability={application?.availability ?? {}}
            onAvailabilityChange={noop}
            submissionUrl={submission?.submission_url ?? ''}
            onSubmissionChange={noop}
            disabled
          />
        </div>

        {/* Review */}
        <div className="lg:flex lg:min-h-0 lg:flex-col">
          <div className="px-4 py-4 sm:px-8 sm:py-6 lg:flex-1 lg:overflow-y-auto">
            <h2 className="text-text-subtle mb-4 text-xs font-medium tracking-wider uppercase">
              Your review
            </h2>
            <div className="flex flex-col gap-4">
              {orderedAnswers.map((answer, i) => {
                const question = questionById.get(answer.question_id)
                const entry = scores[answer.id] ?? { score: '', comment: '' }
                return (
                  <div
                    key={answer.id}
                    className="rounded-xl border border-gray-100 bg-white p-4"
                  >
                    <p className="text-text-muted line-clamp-2 text-xs font-medium">
                      Q{i + 1}. {question?.question_text ?? 'Question'}
                    </p>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`score-${answer.id}`}>Score</Label>
                        <Input
                          id={`score-${answer.id}`}
                          type="number"
                          min={1}
                          max={10}
                          className="w-20"
                          value={entry.score}
                          onChange={(e) =>
                            setScore(answer.id, { score: e.target.value })
                          }
                        />
                      </div>
                      <div className="flex flex-1 flex-col gap-1.5">
                        <Label htmlFor={`comment-${answer.id}`}>Comment</Label>
                        <Input
                          id={`comment-${answer.id}`}
                          value={entry.comment}
                          onChange={(e) =>
                            setScore(answer.id, { comment: e.target.value })
                          }
                          placeholder="Optional"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}

              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <h3 className="text-text-default mb-3 text-sm font-semibold">
                  Overall
                </h3>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="overall">Overall score (1–10)</Label>
                    <Input
                      id="overall"
                      type="number"
                      min={1}
                      max={10}
                      className="w-20"
                      value={overall}
                      onChange={(e) => setOverall(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="reasoning">Reasoning</Label>
                    <textarea
                      id="reasoning"
                      className={TEXTAREA_CLASS}
                      value={reasoning}
                      onChange={(e) => setReasoning(e.target.value)}
                      placeholder="Your overall assessment of this applicant"
                    />
                  </div>
                </div>
              </div>

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
                        <div className="flex items-center justify-between">
                          <span className="text-text-muted text-xs">
                            Reviewer {r.reviewer_nuid}
                          </span>
                          {r.overall_score != null && (
                            <span className="text-text-default text-sm font-semibold">
                              {r.overall_score}/10
                            </span>
                          )}
                        </div>
                        {r.reasoning && (
                          <p className="text-text-muted mt-2 text-sm whitespace-pre-wrap">
                            {r.reasoning}
                          </p>
                        )}
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
              disabled={upsert.isPending || !overall}
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
