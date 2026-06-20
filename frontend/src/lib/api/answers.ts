import { apiFetch, type FetchOptions } from './client'
import type { WrittenAnswer } from './types'

export function getAnswers(applicationId: string, opts?: FetchOptions): Promise<WrittenAnswer[]> {
  return apiFetch(`/applications/${applicationId}/answers`, opts)
}

export function putAnswers(
  applicationId: string,
  body: { answers: { question_id: string; answer_text: string }[] },
  opts?: FetchOptions,
): Promise<WrittenAnswer[]> {
  return apiFetch(`/applications/${applicationId}/answers`, { ...opts, method: 'PUT', body })
}
