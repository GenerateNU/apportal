import { apiFetch, type FetchOptions } from './client'
import type { Applicant } from './types'

export function getApplicant(
  nuid: string,
  opts?: FetchOptions
): Promise<Applicant> {
  return apiFetch(`/applicants/${nuid}`, opts)
}

// Upserts — creates or updates on conflict by nuid
export function upsertApplicant(
  body: {
    nuid: string
    email: string
    full_name: string
    github_username?: string
    graduation_year?: number
    major?: string
  },
  opts?: FetchOptions
): Promise<Applicant> {
  return apiFetch('/applicants', { ...opts, method: 'POST', body })
}
