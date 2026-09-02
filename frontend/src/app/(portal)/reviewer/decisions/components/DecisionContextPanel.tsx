'use client'

import { ExternalLink } from 'lucide-react'
import type {
  DecisionContext,
  InterviewRating,
  ReviewQuestion,
  WrittenReviewDetail,
} from '@/lib/api/types'
import { RATING_COLORS, RATING_LABEL } from '@/lib/interview-ratings'

// Everything already said about this applicant, so the interviewer writing the
// feedback paragraph works from the record rather than from memory. Read-only:
// this page composes the message, it doesn't re-run the review.
export function DecisionContextPanel({
  context,
  reviewQuestions,
  isLoading,
}: {
  context?: DecisionContext
  reviewQuestions: ReviewQuestion[]
  isLoading: boolean
}) {
  if (isLoading) {
    return <p className="text-text-faint text-sm">Loading review history…</p>
  }
  if (!context) return null

  const { interview, recording_reviews, written_reviews } = context
  const nothing =
    !interview && recording_reviews.length === 0 && written_reviews.length === 0

  return (
    <div className="flex flex-col gap-4">
      <h4 className="text-text-faint text-xs font-semibold tracking-wide uppercase">
        Review history
      </h4>

      {nothing && !context.written_reviews_blind && (
        <p className="text-text-faint text-sm">
          Nothing on file for this applicant yet.
        </p>
      )}

      {interview && (
        <Section title="Interview write-up">
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <RatingChip rating={interview.rating} />
              {!interview.submitted_at && (
                <span className="text-text-faint text-xs">
                  Draft — not submitted
                </span>
              )}
              {interview.recording_url && (
                <LinkOut href={interview.recording_url} label="Recording" />
              )}
              {interview.notes_url && (
                <LinkOut href={interview.notes_url} label="Notes" />
              )}
            </div>
            <Body text={interview.comments} empty="No comments written." />
          </div>
        </Section>
      )}

      {(recording_reviews.length > 0 || context.recording_reviews_blind) && (
        <Section title="Recording reviews">
          {recording_reviews.map((r) => (
            <div
              key={r.id}
              className="rounded-lg border border-gray-200 bg-white p-3"
            >
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-text-default text-sm font-medium">
                  {r.reviewer_name || r.reviewer_nuid}
                </span>
                <RatingChip rating={r.rating} />
              </div>
              <Body
                text={r.comments}
                empty={
                  context.recording_reviews_blind
                    ? 'Comments withheld until reviews are released.'
                    : 'No comments written.'
                }
              />
            </div>
          ))}
        </Section>
      )}

      <Section title="Lead written reviews">
        {written_reviews.length === 0 ? (
          <p className="text-text-faint text-sm">
            {context.written_reviews_blind
              ? 'Other leads’ reviews are still blind for this cycle.'
              : 'No leads submitted a written review.'}
          </p>
        ) : (
          written_reviews.map((r) => (
            <WrittenReview key={r.id} review={r} questions={reviewQuestions} />
          ))
        )}
        {written_reviews.length > 0 && context.written_reviews_blind && (
          <p className="text-text-faint text-xs">
            Only your own review is shown — a chief releases the rest from
            Review Progress.
          </p>
        )}
      </Section>
    </div>
  )
}

function WrittenReview({
  review,
  questions,
}: {
  review: WrittenReviewDetail
  questions: ReviewQuestion[]
}) {
  const scores = review.answers
    .map((a) => a.score)
    .filter((s): s is number => s != null)
  const avg = scores.length
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : null

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-text-default text-sm font-medium">
          {review.reviewer_name || review.reviewer_nuid}
        </span>
        <div className="flex items-center gap-2">
          {avg != null && (
            <span className="text-text-default rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium">
              avg {avg.toFixed(1)}/10
            </span>
          )}
          {!review.submitted_at && (
            <span className="text-text-faint text-xs">Draft</span>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {questions.map((q) => {
          const answer = review.answers.find(
            (a) => a.review_question_id === q.id
          )
          if (!answer) return null
          const display =
            answer.score != null
              ? `${answer.score}/10`
              : answer.answer_options?.length
                ? answer.answer_options.join(', ')
                : answer.answer_text
          if (!display) return null
          return (
            <div key={q.id}>
              <p className="text-text-muted text-xs font-medium">
                {q.question_text}
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
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <h5 className="text-text-subtle text-xs font-medium">{title}</h5>
      {children}
    </div>
  )
}

function Body({ text, empty }: { text?: string; empty: string }) {
  if (!text) return <p className="text-text-faint text-sm italic">{empty}</p>
  return <p className="text-text-default text-sm whitespace-pre-wrap">{text}</p>
}

function RatingChip({ rating }: { rating?: InterviewRating }) {
  if (!rating) {
    return <span className="text-text-faint text-xs">No rating</span>
  }
  const { bg, text } = RATING_COLORS[rating]
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-xs font-medium ${bg} ${text}`}
    >
      {RATING_LABEL[rating]}
    </span>
  )
}

function LinkOut({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-brand-blue inline-flex items-center gap-1 text-xs underline underline-offset-2"
    >
      {label}
      <ExternalLink size={11} />
    </a>
  )
}
