import { apiFetch, type FetchOptions } from './client'
import type { CodeChallenge, Role } from './types'

export function getChallenges(
  cycleId: string,
  role?: Role,
  opts?: FetchOptions
): Promise<CodeChallenge[]> {
  const params = role ? `?role=${role}` : ''
  return apiFetch(`/cycles/${cycleId}/challenges${params}`, opts)
}

export function createChallenge(
  cycleId: string,
  body: {
    role: Role
    name: string
    github_repo_url?: string
    instructions?: string
    due_at?: string
  },
  opts?: FetchOptions
): Promise<CodeChallenge> {
  return apiFetch(`/cycles/${cycleId}/challenges`, {
    ...opts,
    method: 'POST',
    body,
  })
}
