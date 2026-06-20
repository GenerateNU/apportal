import { apiFetch, type FetchOptions } from './client'
import type { ReviewerRole, User } from './types'

export function getUsers(reviewerRole?: ReviewerRole, opts?: FetchOptions): Promise<User[]> {
  const params = reviewerRole ? `?reviewer_role=${reviewerRole}` : ''
  return apiFetch(`/users${params}`, opts)
}

export function getUser(nuid: string, opts?: FetchOptions): Promise<User> {
  return apiFetch(`/users/${nuid}`, opts)
}

export function createUser(
  body: {
    nuid: string
    email: string
    full_name: string
    reviewer_role?: ReviewerRole
    github_username?: string
  },
  opts?: FetchOptions,
): Promise<User> {
  return apiFetch('/users', { ...opts, method: 'POST', body })
}

export function updateUser(
  nuid: string,
  body: { email?: string; full_name?: string; reviewer_role?: ReviewerRole; github_username?: string },
  opts?: FetchOptions,
): Promise<User> {
  return apiFetch(`/users/${nuid}`, { ...opts, method: 'PATCH', body })
}
