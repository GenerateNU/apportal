'use client'

import { useState } from 'react'
import { Check, Loader2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { RatingScale } from '@/components/ui/rating-scale'
import { SectionLabel } from '@/components/ui/section-label'
import type { Interview, InterviewRating } from '@/lib/api/types'
import { RATING_COLORS, RATING_LABEL } from '@/lib/interview-ratings'
import { useUpsertInterview } from '@/lib/queries/interviews'
import { formatDate } from '@/lib/utils'
import {
  REVIEW_STATE_BADGE,
  REVIEWED_TEXT,
} from '../../../my-reviews/constants'
import { LinkValue, saveErrorMessage } from './interview-form-parts'

function RatingOverride({
  applicationId,
  current,
}: {
  applicationId: string
  current?: InterviewRating
}) {
  const upsert = useUpsertInterview()
  const [rating, setRating] = useState(current)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function save() {
    setSaved(false)
    setSaveError(null)
    try {
      await upsert.mutateAsync({ applicationId, body: { rating } })
      setSaved(true)
    } catch (err) {
      setSaveError(saveErrorMessage(err))
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <RatingScale
        label="Rating"
        value={rating}
        onChange={(next) => {
          setSaved(false)
          setRating(next)
        }}
        disabled={upsert.isPending}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void save()}
          disabled={upsert.isPending || !rating || rating === current}
        >
          {upsert.isPending ? (
            <>
              <Loader2 className="animate-spin" size={14} />
              Saving…
            </>
          ) : (
            'Save rating'
          )}
        </Button>
        {saveError ? (
          <span className="text-destructive text-sm">{saveError}</span>
        ) : (
          saved &&
          !upsert.isPending && (
            <span
              className={`inline-flex items-center gap-1 text-sm ${REVIEWED_TEXT}`}
            >
              <Check size={14} />
              Saved
            </span>
          )
        )}
      </div>
    </div>
  )
}

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-gray-100 py-2 sm:grid-cols-[7rem_1fr] sm:items-baseline sm:gap-4">
      <dt className="font-display text-text-subtle text-[11px] tracking-wider uppercase">
        {label}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}

export function InterviewSummary({
  applicationId,
  interview,
  interviewerNames,
  isInterviewer,
  isChief,
  onEdit,
}: {
  applicationId: string
  interview: Interview | null | undefined
  interviewerNames: string
  isInterviewer: boolean
  isChief: boolean
  onEdit?: () => void
}) {
  if (!interview) {
    return (
      <EmptyState
        size="sm"
        title="Not started"
        description="This interview hasn't started yet."
      />
    )
  }
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <SectionLabel>
          {isInterviewer ? 'Your write-up' : 'Interview write-up'}
        </SectionLabel>
        {onEdit && (
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil size={14} />
            Edit
          </Button>
        )}
      </div>
      {!interview.submitted_at && !isInterviewer && !isChief && (
        <p className="text-text-faint text-sm">
          You&apos;re not an assigned interviewer, so this is read-only.
        </p>
      )}
      <dl className="border-t border-gray-200">
        {interviewerNames && (
          <Row label="Interviewers">
            <span className="text-text-default text-sm">
              {interviewerNames}
            </span>
          </Row>
        )}
        <Row label="Status">
          {interview.submitted_at ? (
            <Badge className={REVIEW_STATE_BADGE.submitted}>
              Submitted {formatDate(interview.submitted_at)}
            </Badge>
          ) : (
            <Badge className={REVIEW_STATE_BADGE.draft}>Not submitted</Badge>
          )}
        </Row>
        <Row label="Rating">
          {interview.rating ? (
            <Badge
              className={`${RATING_COLORS[interview.rating].bg} ${RATING_COLORS[interview.rating].text}`}
            >
              {RATING_LABEL[interview.rating]}
            </Badge>
          ) : (
            <span className="text-text-faint text-sm">Not rated yet.</span>
          )}
        </Row>
        <Row label="Recording">
          <LinkValue href={interview.recording_url} />
        </Row>
        <Row label="Notes">
          <LinkValue href={interview.notes_url} />
        </Row>
      </dl>
      <div className="flex flex-col gap-1.5">
        <SectionLabel as="h3">Write-up</SectionLabel>
        <p className="text-text-default text-sm leading-relaxed wrap-anywhere whitespace-pre-wrap">
          {interview.writeup || (
            <span className="text-text-faint">Not added yet.</span>
          )}
        </p>
      </div>
      {isChief && (
        <div className="flex flex-col gap-2 border-t border-gray-200 pt-4">
          <SectionLabel as="h3">Override rating</SectionLabel>
          <RatingOverride
            applicationId={applicationId}
            current={interview.rating}
          />
        </div>
      )}
    </section>
  )
}
