import { describe, expect, it } from 'vitest'
import type { User } from '@/lib/api/types'
import { getRoles } from './roles'

// Minimal User factory — getRoles only reads `roles`.
function user(roles: User['roles']): User {
  return { roles } as User
}

describe('getRoles', () => {
  it('maps member, lead, and chief all to reviewer', () => {
    expect(getRoles(user(['member']))).toEqual(['reviewer'])
    expect(getRoles(user(['lead']))).toEqual(['reviewer'])
    expect(getRoles(user(['chief']))).toEqual(['reviewer'])
  })

  it('passes admin and applicant through directly', () => {
    expect(getRoles(user(['admin']))).toEqual(['admin'])
    expect(getRoles(user(['applicant']))).toEqual(['applicant'])
  })

  it('deduplicates reviewer-equivalent roles', () => {
    expect(getRoles(user(['member', 'lead', 'chief']))).toEqual(['reviewer'])
  })

  it('preserves distinct app-level roles together', () => {
    const roles = getRoles(user(['applicant', 'chief', 'admin']))
    expect(new Set(roles)).toEqual(new Set(['applicant', 'reviewer', 'admin']))
    expect(roles).toHaveLength(3)
  })

  it('returns an empty array when the user has no roles', () => {
    expect(getRoles(user([]))).toEqual([])
  })
})
