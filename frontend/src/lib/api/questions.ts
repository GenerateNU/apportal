import { apiFetch, type FetchOptions } from './client'
import type { Question, QuestionType, Role } from './types'

export function getQuestions(
  cycleId: string,
  role?: Role,
  opts?: FetchOptions
): Promise<Question[]> {
  const params = role ? `?role=${role}` : ''
  return apiFetch(`/cycles/${cycleId}/questions${params}`, opts)
}

export function createQuestion(
  cycleId: string,
  body: {
    role?: Role
    question_text: string
    question_type: QuestionType
    is_required?: boolean
    display_order?: number
    options?: string[]
  },
  opts?: FetchOptions
): Promise<Question> {
  return apiFetch(`/cycles/${cycleId}/questions`, {
    ...opts,
    method: 'POST',
    body,
  })
}

export function updateQuestion(
  id: string,
  body: {
    question_text?: string
    question_type?: QuestionType
    is_required?: boolean
    display_order?: number
    options?: string[]
  },
  opts?: FetchOptions
): Promise<Question> {
  return apiFetch(`/questions/${id}`, { ...opts, method: 'PATCH', body })
}

export function deleteQuestion(id: string, opts?: FetchOptions): Promise<void> {
  return apiFetch(`/questions/${id}`, { ...opts, method: 'DELETE' })
}
