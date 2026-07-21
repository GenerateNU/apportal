'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CodeChallenge, Question } from '@/lib/api/types'
import { QuestionField, type AnswerValue } from './QuestionField'

// The shared body of an application — written responses, resume, availability,
// and the code challenge. Used both by the create form (editable) and the
// submitted view (disabled). Purely presentational; all state lives in the
// parent.
// Resume and meeting availability are temporarily disabled (not rendered)
// until they're configurable per cycle in the builder — see TODOs on
// AvailabilityGrid. The props stay on the interface so callers don't need to
// change when this is re-enabled.
export function ApplicationFields({
  questions,
  challenge,
  values,
  onValueChange,
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
      <Section title="Written responses">
        {questions.length === 0 ? (
          <p className="text-text-faint text-sm">
            No written questions for this application.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {questions.map((question, i) => (
              <QuestionField
                key={question.id}
                question={question}
                index={i}
                value={values[question.id] ?? {}}
                disabled={disabled}
                onChange={(next) => onValueChange(question.id, next)}
              />
            ))}
          </div>
        )}
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
