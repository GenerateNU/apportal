'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CodeChallenge, Question } from '@/lib/api/types'
import { AvailabilityGrid } from './AvailabilityGrid'
import { QuestionField, type AnswerValue } from './QuestionField'

// The shared body of an application — written responses, resume, availability,
// and the code challenge. Used both by the create form (editable) and the
// submitted view (disabled). Purely presentational; all state lives in the
// parent.
export function ApplicationFields({
  questions,
  challenge,
  values,
  onValueChange,
  resumeUrl,
  onResumeChange,
  availability,
  onAvailabilityChange,
  submissionUrl,
  onSubmissionChange,
  disabled = false,
}: {
  questions: Question[]
  challenge?: CodeChallenge
  values: Record<string, AnswerValue>
  onValueChange: (questionId: string, next: AnswerValue) => void
  resumeUrl: string
  onResumeChange: (next: string) => void
  availability: Record<string, boolean>
  onAvailabilityChange: (next: Record<string, boolean>) => void
  submissionUrl: string
  onSubmissionChange: (next: string) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-8">
      {questions.length > 0 && (
        <Section title="Written responses">
          <div className="flex flex-col gap-5">
            {questions.map((question) => (
              <QuestionField
                key={question.id}
                question={question}
                value={values[question.id] ?? {}}
                disabled={disabled}
                onChange={(next) => onValueChange(question.id, next)}
              />
            ))}
          </div>
        </Section>
      )}

      {/* TODO: whether a resume is collected (and its label/help text) should
          eventually be configured per cycle in the application builder, rather
          than always shown here. */}
      <Section title="Resume">
        <div className="flex flex-col gap-1.5">
          <Label className="text-text-default" htmlFor="resume">
            Resume link
          </Label>
          <Input
            id="resume"
            type="url"
            value={resumeUrl}
            onChange={(e) => onResumeChange(e.target.value)}
            placeholder="https://…"
            disabled={disabled}
          />
          <p className="text-text-faint text-xs">
            Paste a shareable link (Google Drive, personal site, etc.).
          </p>
        </div>
      </Section>

      <Section title="Meeting availability">
        <AvailabilityGrid
          value={availability}
          onChange={onAvailabilityChange}
          disabled={disabled}
        />
      </Section>

      {challenge && (
        <Section title="Code challenge">
          <div className="flex flex-col gap-1.5">
            <Label className="text-text-default" htmlFor="challenge">
              {challenge.name}
            </Label>
            {challenge.instructions && (
              <p className="text-text-muted text-sm">
                {challenge.instructions}
              </p>
            )}
            <Input
              id="challenge"
              type="url"
              value={submissionUrl}
              onChange={(e) => onSubmissionChange(e.target.value)}
              placeholder="https://github.com/you/your-submission"
              disabled={disabled}
            />
          </div>
        </Section>
      )}
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
    <section className="rounded-xl border border-gray-100 bg-white p-6">
      <h2 className="text-text-default mb-4 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  )
}
