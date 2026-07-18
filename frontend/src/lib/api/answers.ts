import { apiFetch, type FetchOptions } from './client'
import type { WrittenAnswer } from './types'

export function getAnswers(
  applicationId: string,
  opts?: FetchOptions
): Promise<WrittenAnswer[]> {
  return apiFetch(`/applications/${applicationId}/answers`, opts)
}

export function putAnswers(
  applicationId: string,
  body: {
    // Text questions send answer_text; multiple_choice/checkbox questions send
    // answer_options. Both are optional per answer so either kind can be saved.
    answers: {
      question_id: string
      answer_text?: string
      answer_options?: string[]
    }[]
  },
  opts?: FetchOptions
): Promise<WrittenAnswer[]> {
  return apiFetch(`/applications/${applicationId}/answers`, {
    ...opts,
    method: 'PUT',
    body,
  })
}
