'use client'

import { useState } from 'react'
import { ExternalLink, Loader2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SectionLabel } from '@/components/ui/section-label'
import type { InterviewReviewer } from '@/lib/api/types'
import { useUpsertRecordingReview } from '@/lib/queries/recording-reviews'
import { formatDate } from '@/lib/utils'
import { SubmitConfirmDialog, saveErrorMessage } from './interview-form-parts'

const TEXTAREA_CLASS =
  'focus:border-ink text-text-default placeholder:text-text-subtle w-full border border-gray-300 bg-white p-3 text-sm focus:outline-none'

export function RecordingReviewThread({
  applicationId,
  reviews,
  currentNuid,
  nameFor,
  recordingUrl,
}: {
  applicationId: string
  reviews: InterviewReviewer[]
  currentNuid?: string
  nameFor: (nuid: string) => string
  recordingUrl?: string | null
}) {
  const upsert = useUpsertRecordingReview()
  const own = reviews.find((r) => r.reviewer_nuid === currentNuid)
  const submitted = reviews.filter((r) => r.writeup_submitted_at)
  const pending = reviews.filter((r) => !r.writeup_submitted_at && r !== own)

  const [draft, setDraft] = useState(own?.writeup ?? '')
  const [editing, setEditing] = useState(false)
  const [editBody, setEditBody] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(writeup: string, submit: boolean) {
    setError(null)
    try {
      await upsert.mutateAsync({
        applicationId,
        body: { writeup, submit },
      })
      setEditing(false)
    } catch (err) {
      setError(saveErrorMessage(err))
    }
  }

  return (
    <section className="flex flex-col">
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <SectionLabel>Recording reviews</SectionLabel>
        <span className="font-display text-text-subtle text-[11px] tracking-wider uppercase">
          {submitted.length} of {reviews.length} in
        </span>
      </div>

      {submitted.length === 0 && (
        <p className="text-text-faint py-3 text-sm">No reviews yet.</p>
      )}

      {submitted.map((r) => {
        const isOwn = r.reviewer_nuid === currentNuid
        return (
          <div key={r.id} className="border-b border-gray-200 py-3">
            {isOwn && editing ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={4}
                  autoFocus
                  aria-label="Edit your review"
                  className={TEXTAREA_CLASS}
                />
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => void save(editBody, true)}
                    disabled={upsert.isPending || !editBody.trim()}
                  >
                    Save
                  </Button>
                  <Button variant="outline" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 wrap-anywhere">
                  <p className="text-text-muted text-xs">
                    {isOwn
                      ? 'You'
                      : r.reviewer_name || nameFor(r.reviewer_nuid)}
                    <span className="text-text-faint">
                      {' · '}
                      {formatDate(r.writeup_submitted_at)}
                    </span>
                  </p>
                  <p className="text-text-default mt-1 text-sm whitespace-pre-wrap">
                    {r.writeup}
                  </p>
                </div>
                {isOwn && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditBody(r.writeup ?? '')
                      setEditing(true)
                    }}
                    className="text-text-faint hover:text-text-muted -m-2 shrink-0 p-2"
                    aria-label="Edit your review"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}

      {pending.length > 0 && (
        <p className="text-text-faint py-3 text-xs">
          Waiting on{' '}
          {pending
            .map((r) => r.reviewer_name || nameFor(r.reviewer_nuid))
            .join(', ')}
        </p>
      )}

      {own && !own.writeup_submitted_at && (
        <div className="mt-6 flex flex-col gap-4 border border-gray-300 bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-ink text-base font-semibold">
                Your review
              </span>
              <span className="text-text-muted text-sm">
                Watch the recording, then share your read on the applicant.
              </span>
            </div>
            <span className="font-display text-destructive shrink-0 pt-1 text-[10px] tracking-wider uppercase">
              Required
            </span>
          </div>
          {recordingUrl && (
            <a
              href={recordingUrl}
              target="_blank"
              rel="noreferrer"
              className="text-ink inline-flex w-fit items-center gap-1 text-sm hover:underline"
            >
              Open recording
              <ExternalLink size={12} />
            </a>
          )}
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="What stood out, strengths, concerns…"
            aria-label="Your recording review"
            aria-required
            rows={6}
            className={TEXTAREA_CLASS}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-text-muted text-sm">
              {draft.trim() ? 'Ready to submit' : 'Not submitted yet'}
            </span>
            <Button
              onClick={() => setConfirming(true)}
              disabled={upsert.isPending || !draft.trim()}
            >
              {upsert.isPending ? (
                <>
                  <Loader2 className="animate-spin" size={14} />
                  Submitting…
                </>
              ) : (
                'Submit review'
              )}
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-destructive mt-2 text-sm">{error}</p>}

      <SubmitConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        pending={upsert.isPending}
        onConfirm={() => void save(draft, true)}
        title="Submit your review?"
        description="Everyone reviewing this recording will see it. You can still edit it afterwards."
      />
    </section>
  )
}
