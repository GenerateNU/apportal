import type { AnyFieldApi } from '@tanstack/react-form'
import type { AnswerValue, FieldQuestion } from '../components/QuestionField'
import { isOtherOption } from './other-option'
import { urlError } from './url'

export const REQUIRED_MESSAGE = 'This question is required.'
export const OTHER_MESSAGE = 'Tell us more about your answer.'

export function isEmptyAnswer(
  question: FieldQuestion,
  value: AnswerValue | undefined
) {
  if (question.question_type === 'checkbox') return !value?.options?.length
  if (question.question_type === 'url') {
    return !value?.text?.trim() && !value?.filePath
  }
  return !value?.text?.trim()
}

export function answerError(
  question: FieldQuestion,
  value: AnswerValue | undefined
): string | undefined {
  if (question.is_required && isEmptyAnswer(question, value)) {
    return REQUIRED_MESSAGE
  }
  if (question.question_type === 'url' && value?.text?.trim()) {
    return urlError(value.text) ?? undefined
  }
  const picked =
    question.question_type === 'checkbox'
      ? (value?.options ?? [])
      : ['multiple_choice', 'dropdown'].includes(question.question_type) &&
          value?.text
        ? [value.text]
        : []
  if (picked.some((p) => isOtherOption(p) && !p.includes(':'))) {
    return OTHER_MESSAGE
  }
  return undefined
}

export function challengeLinkError(value: string): string | undefined {
  if (!value.trim()) return 'Add a link to your submission.'
  return urlError(value) ?? undefined
}

export function scoreMessage(min: number, max: number) {
  return `Enter a whole number from ${min} to ${max}.`
}

export function reviewAnswerError(
  question: FieldQuestion,
  value: AnswerValue | undefined
): string | undefined {
  if (question.is_required && isEmptyAnswer(question, value)) {
    return REQUIRED_MESSAGE
  }
  return scoreError(question, value)
}

export function scoreError(
  question: FieldQuestion,
  value: AnswerValue | undefined
): string | undefined {
  const text = value?.text?.trim()
  if (question.question_type !== 'score' || !text) return undefined
  const min = question.score_min ?? 1
  const max = question.score_max ?? 10
  const n = Number(text)
  return Number.isInteger(n) && n >= min && n <= max
    ? undefined
    : scoreMessage(min, max)
}

// A filled-in answer shows its error once typing settles; an empty one waits
// until the field is blurred or edited, or errors are revealed for the page.
export function visibleError(
  field: AnyFieldApi,
  settled: boolean,
  reveal: boolean,
  hasValue: boolean
) {
  const { errors, isBlurred, isDirty } = field.state.meta
  const error = errors.find(Boolean) as string | undefined
  return reveal || isBlurred || (settled && (isDirty || hasValue))
    ? error
    : undefined
}
