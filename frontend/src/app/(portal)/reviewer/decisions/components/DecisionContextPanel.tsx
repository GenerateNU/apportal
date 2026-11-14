'use client'

import { ExternalLink } from 'lucide-react'
import type {
  DecisionContext,
  InterviewRating,
  ReviewQuestion,
  WrittenReviewDetail,
} from '@/lib/api/types'
import { RATING_COLORS, RATING_LABEL } from '@/lib/interview-ratings'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { LoadingText } from '@/components/ui/loading-text'
import { SectionLabel } from '@/components/ui/section-label'

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
    return <LoadingText label="Loading review history…" />
  }
  if (!context) return null

  const { interview, recording_reviews, written_reviews } = context
  const nothing =
    !interview && recording_reviews.length === 0 && written_reviews.length === 0

  return (
    <div className="flex flex-col gap-4">
      <SectionLabel as="h3">Review history</SectionLabel>

      {nothing && !context.written_reviews_blind && (
        <p className="text-text-faint text-sm">
          Nothing on file for this applicant yet.
        </p>
      )}

      {interview && (
        <Section title="Interview">
          <div className="flex flex-wrap items-center gap-2">
            <RatingChip rating={interview.rating} />
            {interview.recording_url && (
              <LinkOut href={interview.recording_url} label="Recording" />
            )}
            {interview.notes_url && (
              <LinkOut href={interview.notes_url} label="Notes" />
            )}
          </div>
          <Card variant="flat" padding="sm">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-text-default text-sm font-medium">
                {interview.interviewers
                  .map((iv) => iv.interviewer_name || iv.interviewer_nuid)
                  .join(', ')}
              </span>
              {!interview.submitted_at && (
                <span className="text-text-faint text-xs">
                  Draft — not submitted
                </span>
              )}
            </div>
            <Body text={interview.writeup} empty="No write-up yet." />
          </Card>
        </Section>
      )}

      {(recording_reviews.length > 0 || context.recording_reviews_blind) && (
        <Section title="Recording reviews">
          {recording_reviews.map((r) => (
            <Card key={r.id} variant="flat" padding="sm">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-text-default text-sm font-medium">
                  {r.reviewer_name || r.reviewer_nuid}
                </span>
                {!r.writeup_submitted_at && (
                  <span className="text-text-faint text-xs">Draft</span>
                )}
              </div>
              <Body
                text={r.writeup}
                empty={
                  context.recording_reviews_blind
                    ? 'Comments withheld until reviews are released.'
                    : 'No comments written.'
                }
              />
            </Card>
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
    <Card variant="flat" padding="sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-text-default text-sm font-medium">
          {review.reviewer_name || review.reviewer_nuid}
        </span>
        <div className="flex items-center gap-2">
          {avg != null && (
            <Badge className="text-text-default">avg {avg.toFixed(1)}/10</Badge>
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
    </Card>
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
  return <Badge className={`${bg} ${text}`}>{RATING_LABEL[rating]}</Badge>
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
