'use client'

import { SectionLabel } from '@/components/ui/section-label'
import type { CodeChallenge, Question } from '@/lib/api/types'
import { ChallengeField } from './ChallengeField'
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
  startIndex = 0,
  challenge,
  values,
  onValueChange,
  submissionUrl,
  onSubmissionChange,
  disabled = false,
  applicationId,
}: {
  questions: Question[]
  // Offset for question numbering — lets a page's slice of questions
  // continue the count (6, 7, 8…) rather than restarting at 1.
  startIndex?: number
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
  // Threaded through to QuestionField for its `url` file-upload affordance.
  applicationId?: string
}) {
  return (
    <div className="flex flex-col gap-8">
      <Section title={challenge ? 'Written responses' : undefined}>
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
                index={startIndex + i}
                value={values[question.id] ?? {}}
                disabled={disabled}
                applicationId={applicationId}
                onChange={(next) => onValueChange(question.id, next)}
              />
            ))}
          </div>
        )}
      </Section>

      {challenge && (
        <Section title="Challenge">
          <ChallengeField
            challenge={challenge}
            value={submissionUrl}
            onChange={onSubmissionChange}
            disabled={disabled}
          />
        </Section>
      )}
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title?: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-4">
      {title && <SectionLabel>{title}</SectionLabel>}
      {children}
    </section>
  )
}
