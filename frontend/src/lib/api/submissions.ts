import { apiFetch, type FetchOptions } from './client'
import type { CodeSubmission } from './types'

export function getSubmission(
  applicationId: string,
  opts?: FetchOptions
): Promise<CodeSubmission> {
  return apiFetch(`/applications/${applicationId}/code-submission`, opts)
}

export function putSubmission(
  applicationId: string,
  body: {
    github_repo_url?: string
    submitted_at?: string
    score?: number
    feedback?: string
  },
  opts?: FetchOptions
): Promise<CodeSubmission> {
  return apiFetch(`/applications/${applicationId}/code-submission`, {
    ...opts,
    method: 'PUT',
    body,
  })
}
