'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Role, WrittenAnswer } from '@/lib/api/types'
import { useAnswers } from '@/lib/queries/answers'
import { useApplicant } from '@/lib/queries/applicants'
import { useQuestions } from '@/lib/queries/questions'
import {
  useUpsertWrittenReview,
  useWrittenReviews,
} from '@/lib/queries/written-reviews'
import { ROLE_LABEL } from '@/lib/roles'
import { REVIEWER_ACTOR } from '@/lib/stub-actor'

const OPTS = { actor: REVIEWER_ACTOR }
const TEXTAREA_CLASS =
  'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 min-h-24 w-full rounded-lg border bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:ring-3'

type ScoreEntry = { score: string; comment: string }

function answerText(a: WrittenAnswer): string {
  if (a.answer_text) return a.answer_text
  const opts = a.answer_options
  if (Array.isArray(opts) && opts.length) return (opts as string[]).join(', ')
  return '—'
}

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
  const { data: applicant } = useApplicant(applicantNuid, OPTS)
  const { data: answers = [] } = useAnswers(applicationId, OPTS)
  const { data: questions = [] } = useQuestions(cycleId, role, OPTS)
  const { data: reviews = [] } = useWrittenReviews(applicationId, OPTS)
  const upsert = useUpsertWrittenReview()

  const own = reviews.find((r) => r.reviewer_nuid === REVIEWER_ACTOR.nuid)
  const others = reviews.filter((r) => r.reviewer_nuid !== REVIEWER_ACTOR.nuid)

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
      opts: OPTS,
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
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-white px-8 py-3">
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

      {/* Split: application (left) · review (right) */}
      <div className="grid min-h-0 flex-1 grid-cols-2 overflow-hidden">
        {/* Application */}
        <div className="overflow-y-auto border-r border-gray-100 px-8 py-6">
          <h2 className="text-text-subtle mb-4 text-xs font-medium tracking-wider uppercase">
            Application
          </h2>
          {orderedAnswers.length === 0 ? (
            <p className="text-text-faint text-sm">No answers submitted.</p>
          ) : (
            <div className="flex flex-col gap-5">
              {orderedAnswers.map((answer, i) => {
                const question = questionById.get(answer.question_id)
                return (
                  <div key={answer.id}>
                    <p className="text-text-default text-sm font-medium">
                      {i + 1}. {question?.question_text ?? 'Question'}
                    </p>
                    <p className="text-text-muted mt-1.5 text-sm whitespace-pre-wrap">
                      {answerText(answer)}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Review */}
        <div className="flex min-h-0 flex-col">
          <div className="flex-1 overflow-y-auto px-8 py-6">
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
                    <div className="mt-3 flex items-end gap-3">
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
            </div>
          </div>

          {/* Action footer */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-white px-8 py-4">
            {saved && !upsert.isPending && (
              <span className="text-status-open mr-auto inline-flex items-center gap-1 text-sm">
                <Check size={14} />
                Saved
              </span>
            )}
            <Button
              variant="outline"
              onClick={() => save(false)}
              disabled={upsert.isPending}
            >
              Save draft
            </Button>
            <Button
              onClick={() => save(true)}
              disabled={upsert.isPending || !overall}
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
