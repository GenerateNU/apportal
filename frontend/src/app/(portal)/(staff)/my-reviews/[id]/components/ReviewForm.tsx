'use client'

import { useState } from 'react'
import { useForm, useSelector, type AnyFieldApi } from '@tanstack/react-form'
import { Check, Loader2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SectionLabel } from '@/components/ui/section-label'
import type { ReviewQuestion, WrittenReviewDetail } from '@/lib/api/types'
import { APIError } from '@/lib/api/client'
import { useUpsertWrittenReview } from '@/lib/queries/written-reviews'
import { cn, formatDate } from '@/lib/utils'
import { PAGE_R } from '@/components/ui/page-shell'
import {
  QuestionField,
  type AnswerValue,
} from '@/app/(portal)/applicant/applications/components/QuestionField'
import { useSettledValue } from '@/app/(portal)/applicant/applications/lib/url'
import {
  isEmptyAnswer,
  reviewAnswerError,
  scoreError,
  visibleError,
} from '@/app/(portal)/applicant/applications/lib/validation'
import { REVIEWED_TEXT } from '../../constants'

function dueLabel(iso: string) {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
  if (days > 1) return `Due in ${days} days`
  if (days === 1) return 'Due tomorrow'
  if (days === 0) return 'Due today'
  return `Overdue by ${-days} ${days === -1 ? 'day' : 'days'}`
}

function initialAnswers(own: WrittenReviewDetail | undefined) {
  const map: Record<string, AnswerValue> = {}
  for (const a of own?.answers ?? []) {
    if (a.score != null) map[a.review_question_id] = { text: String(a.score) }
    else if (a.answer_options?.length) {
      map[a.review_question_id] = { options: a.answer_options }
    } else map[a.review_question_id] = { text: a.answer_text ?? '' }
  }
  return map
}

function ReviewAnswerField({
  field,
  question,
  index,
  reveal,
  disabled,
}: {
  field: AnyFieldApi
  question: ReviewQuestion
  index: number
  reveal: boolean
  disabled: boolean
}) {
  const value = (field.state.value ?? {}) as AnswerValue
  const serialized = JSON.stringify(value)
  const settled = useSettledValue(serialized) === serialized
  return (
    <QuestionField
      question={question}
      index={index}
      value={value}
      onChange={(next) => field.handleChange(next)}
      onBlur={field.handleBlur}
      error={
        disabled
          ? undefined
          : visibleError(
              field,
              settled,
              reveal,
              !isEmptyAnswer(question, value)
            )
      }
      disabled={disabled}
    />
  )
}

export function ReviewForm({
  applicationId,
  reviewQuestions,
  own,
  reviewClosesAt,
  children,
}: {
  applicationId: string
  reviewQuestions: ReviewQuestion[]
  own: WrittenReviewDetail | undefined
  reviewClosesAt?: string
  children?: React.ReactNode
}) {
  const upsert = useUpsertWrittenReview()
  const submitted = !!own?.submitted_at
  const form = useForm({ defaultValues: { answers: initialAnswers(own) } })
  const values = useSelector(form.store, (state) => state.values.answers)
  const [confirming, setConfirming] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const invalid = reviewQuestions.some(
    (q) => !!reviewAnswerError(q, values[q.id])
  )
  const badScore = reviewQuestions.some((q) => !!scoreError(q, values[q.id]))
  const required = reviewQuestions.filter((q) => q.is_required)
  const answeredCount = required.filter(
    (q) => !reviewAnswerError(q, values[q.id])
  ).length

  async function save(submit: boolean) {
    setSaved(false)
    setSaveError(null)
    const answers = reviewQuestions.map((q) => {
      const v = values[q.id]
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
    try {
      await upsert.mutateAsync({ applicationId, body: { submit, answers } })
      setSaved(true)
    } catch (err) {
      setSaveError(
        err instanceof APIError && err.status === 409
          ? "This review was already submitted and can't be changed."
          : "Couldn't save your review. Please try again."
      )
    }
  }

  return (
    <>
      <div
        className={cn('py-6 pl-6 sm:pl-8 lg:flex-1 lg:overflow-y-auto', PAGE_R)}
      >
        <SectionLabel className={reviewClosesAt ? 'mb-1' : 'mb-4'}>
          Your review
        </SectionLabel>
        {reviewClosesAt && !submitted && (
          <p
            className="text-text-muted mb-4 text-xs"
            title={new Date(reviewClosesAt).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          >
            {dueLabel(reviewClosesAt)}
          </p>
        )}
        {submitted && (
          <div className="border-border bg-muted/40 text-text-muted mb-4 flex items-center gap-2 border px-4 py-3 text-sm">
            <Lock size={14} />
            You submitted this review on {formatDate(own?.submitted_at)}. It
            can&apos;t be changed.
          </div>
        )}
        <div className="flex flex-col gap-4">
          {reviewQuestions.length === 0 ? (
            <p className="text-text-faint text-sm">
              No review questions have been set up for this cycle/role yet.
            </p>
          ) : (
            reviewQuestions.map((q, i) => (
              <form.Field
                key={q.id}
                name={`answers.${q.id}`}
                validators={{
                  onMount: ({ value }) => reviewAnswerError(q, value),
                  onChange: ({ value }) => reviewAnswerError(q, value),
                  onBlur: ({ value }) => reviewAnswerError(q, value),
                }}
              >
                {(field) => (
                  <ReviewAnswerField
                    field={field}
                    question={q}
                    index={i}
                    reveal={false}
                    disabled={submitted}
                  />
                )}
              </form.Field>
            ))
          )}
          {children}
        </div>
      </div>

      {!submitted && (
        <div
          className={cn(
            'flex flex-col items-stretch gap-3 border-t border-gray-200 bg-white py-4 pl-6 sm:flex-row sm:items-center sm:justify-end sm:pl-8',
            PAGE_R
          )}
        >
          <span
            className={cn(
              'text-sm sm:mr-auto',
              invalid ? 'text-text-muted' : 'text-status-open'
            )}
          >
            {invalid
              ? `${answeredCount} of ${required.length} answered`
              : 'Ready to submit'}
          </span>
          {saveError ? (
            <span className="text-destructive text-sm">{saveError}</span>
          ) : (
            saved &&
            !upsert.isPending && (
              <span
                className={`inline-flex items-center gap-1 text-sm ${REVIEWED_TEXT}`}
              >
                <Check size={14} />
                Draft saved
              </span>
            )
          )}
          <Button
            variant="outline"
            onClick={() => void save(false)}
            disabled={upsert.isPending || badScore}
            className="w-full sm:w-auto"
          >
            Save draft
          </Button>
          <Button
            onClick={() => setConfirming(true)}
            disabled={upsert.isPending || invalid}
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
        </div>
      )}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit your review?</DialogTitle>
            <DialogDescription>
              Once submitted, you can&apos;t change your answers. Make sure your
              scores and notes are final.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Keep editing
            </Button>
            <Button
              disabled={upsert.isPending}
              onClick={() => {
                setConfirming(false)
                void save(true)
              }}
            >
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
