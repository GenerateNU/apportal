import type { AnswerValue, FieldQuestion } from '../components/QuestionField'
import { urlError } from './url'

export const REQUIRED_MESSAGE = 'This question is required.'

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
  return undefined
}

export function challengeLinkError(value: string): string | undefined {
  if (!value.trim()) return 'Add a link to your submission.'
  return urlError(value) ?? undefined
}
