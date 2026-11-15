'use client'

import { useState } from 'react'
import { useForm, useSelector } from '@tanstack/react-form'
import { ExternalLink } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PAGE_R } from '@/components/ui/page-shell'
import { RatingScale } from '@/components/ui/rating-scale'
import { SectionLabel } from '@/components/ui/section-label'
import type { Interview, InterviewRating } from '@/lib/api/types'
import { useUpsertInterview } from '@/lib/queries/interviews'
import { cn } from '@/lib/utils'
import {
  normalizeUrl,
  urlError,
} from '@/app/(portal)/applicant/applications/lib/url'
import {
  FormField,
  FormFooter,
  SubmitConfirmDialog,
  TEXTAREA_CLASS,
  saveErrorMessage,
} from './interview-form-parts'

const linkError =
  (missing: string) =>
  ({ value }: { value: string }) =>
    value.trim() ? (urlError(value) ?? undefined) : missing
const recordingError = linkError('Add the recording link.')
const notesError = linkError('Add your notes link.')
const writeupError = ({ value }: { value: string }) =>
  value.trim() ? undefined : 'Add a write-up.'
const ratingError = ({ value }: { value: InterviewRating | undefined }) =>
  value ? undefined : 'Choose a rating.'

function OpenLink({ href }: { href?: string | null }) {
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-ink inline-flex shrink-0 items-center gap-1 text-sm hover:underline"
    >
      Open
      <ExternalLink size={12} />
    </a>
  )
}

export function InterviewWriteupForm({
  applicationId,
  interview,
  interviewerNames,
  onDone,
}: {
  applicationId: string
  interview: Interview
  interviewerNames: string
  onDone?: () => void
}) {
  const upsert = useUpsertInterview()
  const form = useForm({
    defaultValues: {
      recordingUrl: interview.recording_url ?? '',
      notesUrl: interview.notes_url ?? '',
      writeup: interview.writeup ?? '',
      rating: interview.rating as InterviewRating | undefined,
    },
  })
  const values = useSelector(form.store, (state) => state.values)
  const [confirming, setConfirming] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const badLink = !!urlError(values.recordingUrl) || !!urlError(values.notesUrl)
  const answered = [
    values.recordingUrl.trim(),
    values.notesUrl.trim(),
    values.writeup.trim(),
    values.rating,
  ].filter(Boolean).length
  const invalid = badLink || answered < 4

  async function save(submit: boolean) {
    setSaved(false)
    setSaveError(null)
    try {
      await upsert.mutateAsync({
        applicationId,
        body: {
          recording_url: normalizeUrl(values.recordingUrl) || undefined,
          notes_url: normalizeUrl(values.notesUrl) || undefined,
          writeup: values.writeup,
          rating: values.rating,
          submit,
        },
      })
      setSaved(true)
      if (interview.submitted_at) onDone?.()
    } catch (err) {
      setSaveError(saveErrorMessage(err))
    }
  }

  return (
    <>
      <div
        className={cn('py-6 pl-6 sm:pl-8 lg:flex-1 lg:overflow-y-auto', PAGE_R)}
      >
        <section className="flex flex-col gap-4">
          <SectionLabel>Your write-up</SectionLabel>
          {interviewerNames && (
            <p className="text-text-muted text-sm">
              Interviewers: {interviewerNames}
            </p>
          )}
          <Card padding="lg" className="flex flex-col gap-5">
            <form.Field
              name="recordingUrl"
              validators={{
                onMount: recordingError,
                onChange: recordingError,
                onBlur: recordingError,
              }}
            >
              {(field) => (
                <FormField field={field} label="Recording link" required>
                  {(invalidField) => (
                    <div className="flex items-center gap-2">
                      <Input
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={() => {
                          field.handleChange(normalizeUrl(field.state.value))
                          field.handleBlur()
                        }}
                        aria-invalid={invalidField}
                        placeholder="https://…"
                        disabled={upsert.isPending}
                      />
                      <OpenLink href={interview.recording_url} />
                    </div>
                  )}
                </FormField>
              )}
            </form.Field>

            <form.Field
              name="notesUrl"
              validators={{
                onMount: notesError,
                onChange: notesError,
                onBlur: notesError,
              }}
            >
              {(field) => (
                <FormField
                  field={field}
                  label="Notes link (e.g. Granola)"
                  required
                >
                  {(invalidField) => (
                    <div className="flex items-center gap-2">
                      <Input
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={() => {
                          field.handleChange(normalizeUrl(field.state.value))
                          field.handleBlur()
                        }}
                        aria-invalid={invalidField}
                        placeholder="https://…"
                        disabled={upsert.isPending}
                      />
                      <OpenLink href={interview.notes_url} />
                    </div>
                  )}
                </FormField>
              )}
            </form.Field>

            <form.Field
              name="writeup"
              validators={{
                onMount: writeupError,
                onChange: writeupError,
                onBlur: writeupError,
              }}
            >
              {(field) => (
                <FormField field={field} label="Write-up" required>
                  {(invalidField) => (
                    <textarea
                      className={TEXTAREA_CLASS}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      aria-invalid={invalidField}
                      placeholder="Summarize how the interview went…"
                      disabled={upsert.isPending}
                    />
                  )}
                </FormField>
              )}
            </form.Field>

            <form.Field
              name="rating"
              validators={{
                onMount: ratingError,
                onChange: ratingError,
                onBlur: ratingError,
              }}
            >
              {(field) => (
                <FormField field={field} label="Rating" required>
                  {(invalidField) => (
                    <div onBlur={field.handleBlur}>
                      <RatingScale
                        label="Rating"
                        value={field.state.value}
                        onChange={(next) => field.handleChange(next)}
                        invalid={invalidField}
                        disabled={upsert.isPending}
                      />
                    </div>
                  )}
                </FormField>
              )}
            </form.Field>
          </Card>
        </section>
      </div>

      <FormFooter
        answered={answered}
        total={4}
        invalid={invalid}
        saved={saved}
        saveError={saveError}
        pending={upsert.isPending}
        draftDisabled={!interview.submitted_at && badLink}
        onSaveDraft={() =>
          interview.submitted_at ? onDone?.() : void save(false)
        }
        draftLabel={interview.submitted_at ? 'Cancel' : 'Save draft'}
        onSubmit={() =>
          interview.submitted_at ? void save(true) : setConfirming(true)
        }
        submitLabel={
          interview.submitted_at ? 'Save changes' : 'Submit write-up'
        }
        submittedAt={interview.submitted_at}
      />

      <SubmitConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        pending={upsert.isPending}
        onConfirm={() => void save(true)}
        description="This unlocks the recording reviews. You can still edit it afterwards."
      />
    </>
  )
}
