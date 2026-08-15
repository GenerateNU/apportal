'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Loader2, Plus, Trash2, X } from 'lucide-react'
import { PageContainer } from '@/components/PageContainer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type {
  InterviewScript,
  InterviewScriptChallengeTrack,
  InterviewScriptQuestion,
} from '@/lib/api/types'
import {
  useInterviewScript,
  useUpdateInterviewScript,
} from '@/lib/queries/interview-script'

const TEXTAREA_CLASS =
  'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 min-h-24 w-full rounded-lg border bg-transparent px-3.5 py-2.5 text-base transition-all outline-none focus-visible:ring-3 hover:border-gray-300 resize-none'

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

// Shared editor for a flat list of strings (follow-ups, checklist items) —
// index-keyed since these are freeform strings with no stable id of their own.
function StringListEditor({
  items,
  onChange,
  addLabel,
  placeholder,
}: {
  items: string[]
  onChange: (next: string[]) => void
  addLabel: string
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={item}
            placeholder={placeholder}
            onChange={(e) => {
              const next = [...items]
              next[i] = e.target.value
              onChange(next)
            }}
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            aria-label="Remove"
            className="text-text-faint hover:text-red-600"
          >
            <X size={16} />
          </button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={() => onChange([...items, ''])}
      >
        <Plus size={14} />
        {addLabel}
      </Button>
    </div>
  )
}

function QuestionEditor({
  question,
  onChange,
  onRemove,
}: {
  question: InterviewScriptQuestion
  onChange: (next: InterviewScriptQuestion) => void
  onRemove: () => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <textarea
          className={TEXTAREA_CLASS}
          value={question.prompt}
          onChange={(e) => onChange({ ...question, prompt: e.target.value })}
          rows={2}
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove question"
          className="text-text-faint mt-1 shrink-0 hover:text-red-600"
        >
          <Trash2 size={16} />
        </button>
      </div>
      <Field label="Follow-ups">
        <StringListEditor
          items={question.followUps ?? []}
          onChange={(next) => onChange({ ...question, followUps: next })}
          addLabel="Add follow-up"
          placeholder="A deeper prompt for a thin answer…"
        />
      </Field>
    </div>
  )
}

function ChallengeTrackEditor({
  track,
  onChange,
}: {
  track: InterviewScriptChallengeTrack
  onChange: (next: InterviewScriptChallengeTrack) => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
      <Field label="Track label">
        <Input
          value={track.label}
          onChange={(e) => onChange({ ...track, label: e.target.value })}
        />
      </Field>
      <Field label="Follow-ups">
        <StringListEditor
          items={track.followUps}
          onChange={(next) => onChange({ ...track, followUps: next })}
          addLabel="Add follow-up"
        />
      </Field>
    </div>
  )
}

export function InterviewScriptEditClient() {
  const { data: script, isLoading } = useInterviewScript()
  const update = useUpdateInterviewScript()
  const [form, setForm] = useState<InterviewScript | null>(null)
  const [saved, setSaved] = useState(false)

  if (!form && script) setForm(script)

  function updateField<K extends keyof InterviewScript>(
    key: K,
    value: InterviewScript[K]
  ) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
    setSaved(false)
  }

  async function save() {
    if (!form) return
    await update.mutateAsync({
      body: {
        intro_speech: form.intro_speech,
        recording_reminder: form.recording_reminder,
        questions: form.questions,
        closing_note: form.closing_note,
        challenge_intro: form.challenge_intro,
        challenge_tracks: form.challenge_tracks,
        availability_reminder: form.availability_reminder,
        post_interview_checklist: form.post_interview_checklist,
      },
    })
    setSaved(true)
  }

  if (isLoading || !form) {
    return (
      <PageContainer>
        <p className="text-text-faint text-sm">Loading script…</p>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/reviewer/interview-script"
            className="text-text-muted hover:text-text-default mb-2 inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft size={14} />
            Back to interview script
          </Link>
          <h1 className="text-text-default text-2xl font-semibold">
            Edit interview script
          </h1>
          <p className="text-text-muted mt-1 text-sm">
            Changes apply immediately for every interviewer — there&apos;s no
            per-cycle history, so update the bracketed placeholders (like{' '}
            <code className="text-text-default rounded bg-gray-100 px-1 py-0.5 text-xs">
              [cycle start date]
            </code>
            ) whenever a new cycle starts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && !update.isPending && (
            <span className="inline-flex items-center gap-1 text-sm text-green-700">
              <Check size={14} />
              Saved
            </span>
          )}
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending ? (
              <>
                <Loader2 className="animate-spin" size={14} />
                Saving…
              </>
            ) : (
              'Save changes'
            )}
          </Button>
        </div>
      </div>

      <div className="flex max-w-3xl flex-col gap-6">
        <Field label="Intro speech" htmlFor="intro-speech">
          <textarea
            id="intro-speech"
            className={`${TEXTAREA_CLASS} min-h-64`}
            value={form.intro_speech}
            onChange={(e) => updateField('intro_speech', e.target.value)}
          />
        </Field>

        <Field label="Recording reminder" htmlFor="recording-reminder">
          <Input
            id="recording-reminder"
            value={form.recording_reminder}
            onChange={(e) => updateField('recording_reminder', e.target.value)}
          />
        </Field>

        <div className="flex flex-col gap-2">
          <Label>Questions</Label>
          <div className="flex flex-col gap-3">
            {form.questions.map((q, i) => (
              <QuestionEditor
                key={i}
                question={q}
                onChange={(next) =>
                  updateField(
                    'questions',
                    form.questions.map((existing, idx) =>
                      idx === i ? next : existing
                    )
                  )
                }
                onRemove={() =>
                  updateField(
                    'questions',
                    form.questions.filter((_, idx) => idx !== i)
                  )
                }
              />
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() =>
              updateField('questions', [...form.questions, { prompt: '' }])
            }
          >
            <Plus size={14} />
            Add question
          </Button>
        </div>

        <Field label="Closing note" htmlFor="closing-note">
          <textarea
            id="closing-note"
            className={TEXTAREA_CLASS}
            value={form.closing_note}
            onChange={(e) => updateField('closing_note', e.target.value)}
          />
        </Field>

        <Field label="Challenge intro" htmlFor="challenge-intro">
          <textarea
            id="challenge-intro"
            className={TEXTAREA_CLASS}
            value={form.challenge_intro}
            onChange={(e) => updateField('challenge_intro', e.target.value)}
          />
        </Field>

        <div className="flex flex-col gap-2">
          <Label>Challenge tracks</Label>
          <ChallengeTrackEditor
            track={form.challenge_tracks.backend}
            onChange={(next) =>
              updateField('challenge_tracks', {
                ...form.challenge_tracks,
                backend: next,
              })
            }
          />
          <ChallengeTrackEditor
            track={form.challenge_tracks.frontend}
            onChange={(next) =>
              updateField('challenge_tracks', {
                ...form.challenge_tracks,
                frontend: next,
              })
            }
          />
        </div>

        <Field label="Availability reminder" htmlFor="availability-reminder">
          <textarea
            id="availability-reminder"
            className={TEXTAREA_CLASS}
            value={form.availability_reminder}
            onChange={(e) =>
              updateField('availability_reminder', e.target.value)
            }
          />
        </Field>

        <div className="flex flex-col gap-2">
          <Label>Post-interview checklist</Label>
          <StringListEditor
            items={form.post_interview_checklist}
            onChange={(next) => updateField('post_interview_checklist', next)}
            addLabel="Add checklist item"
          />
        </div>
      </div>
    </PageContainer>
  )
}
