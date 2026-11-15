'use client'

import type { AnyFieldApi } from '@tanstack/react-form'
import type { CodeChallenge, Question } from '@/lib/api/types'
import { ChallengeField } from '../../components/ChallengeField'
import { QuestionField, type AnswerValue } from '../../components/QuestionField'
import { useSettledValue } from '../../lib/url'
import {
  answerError,
  challengeLinkError,
  isEmptyAnswer,
  visibleError,
} from '../../lib/validation'
import type { ApplicationForm } from './useApplicationForm'

function AnswerField({
  field,
  question,
  index,
  reveal,
  disabled,
  applicationId,
}: {
  field: AnyFieldApi
  question: Question
  index: number
  reveal: boolean
  disabled: boolean
  applicationId?: string
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
      error={visibleError(
        field,
        settled,
        reveal,
        !isEmptyAnswer(question, value)
      )}
      disabled={disabled}
      applicationId={applicationId}
    />
  )
}

function SubmissionField({
  field,
  challenge,
  reveal,
  disabled,
}: {
  field: AnyFieldApi
  challenge: CodeChallenge
  reveal: boolean
  disabled: boolean
}) {
  const value = (field.state.value ?? '') as string
  const settled = useSettledValue(value) === value

  return (
    <ChallengeField
      challenge={challenge}
      value={value}
      onChange={(next) => field.handleChange(next)}
      onBlur={field.handleBlur}
      error={visibleError(field, settled, reveal, !!value.trim())}
      disabled={disabled}
    />
  )
}

export function ApplicationFormFields({
  form,
  questions,
  startIndex,
  challenge,
  reveal,
  disabled,
  applicationId,
}: {
  form: ApplicationForm
  questions: Question[]
  startIndex: number
  challenge?: CodeChallenge
  reveal: boolean
  disabled: boolean
  applicationId?: string
}) {
  return (
    <div className="flex flex-col gap-8">
      {questions.length > 0 && (
        <section className="flex flex-col gap-4">
          {questions.map((question, i) => (
            <form.Field
              key={question.id}
              name={`answers.${question.id}`}
              validators={{
                onMount: ({ value }) => answerError(question, value),
                onChange: ({ value }) => answerError(question, value),
                onBlur: ({ value }) => answerError(question, value),
              }}
            >
              {(field) => (
                <AnswerField
                  field={field}
                  question={question}
                  index={startIndex + i}
                  reveal={reveal}
                  disabled={disabled}
                  applicationId={applicationId}
                />
              )}
            </form.Field>
          ))}
        </section>
      )}

      {challenge && (
        <section className="flex flex-col gap-4">
          <form.Field
            name="submissionUrl"
            validators={{
              onMount: ({ value }) => challengeLinkError(value),
              onChange: ({ value }) => challengeLinkError(value),
              onBlur: ({ value }) => challengeLinkError(value),
            }}
          >
            {(field) => (
              <SubmissionField
                field={field}
                challenge={challenge}
                reveal={reveal}
                disabled={disabled}
              />
            )}
          </form.Field>
        </section>
      )}
    </div>
  )
}
