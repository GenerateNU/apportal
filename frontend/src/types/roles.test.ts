import { describe, expect, it } from 'vitest'
import type { CurrentUser } from '@/lib/api/types'
import {
  defaultDashboard,
  getRoles,
  hasChiefAccess,
  hasReviewerAccess,
} from './roles'

function user(
  roles: CurrentUser['roles'],
  staff: CurrentUser['staff'] = []
): Pick<CurrentUser, 'roles' | 'staff'> {
  return { roles, staff }
}

const lead = { cycle_id: 'c1', role: 'lead' } as const
const chief = { cycle_id: 'c2', role: 'chief' } as const

describe('getRoles', () => {
  it('makes anyone on a cycle’s staff a reviewer', () => {
    expect(getRoles(user(['applicant'], [lead]))).toEqual([
      'applicant',
      'reviewer',
    ])
    expect(getRoles(user(['applicant'], [chief]))).toContain('reviewer')
  })

  it('passes admin and applicant through directly', () => {
    expect(getRoles(user(['admin']))).toEqual(['admin'])
    expect(getRoles(user(['applicant']))).toEqual(['applicant'])
  })

  it('adds reviewer once however many cycles they staff', () => {
    expect(getRoles(user([], [lead, chief]))).toEqual(['reviewer'])
  })

  it('returns an empty array when the user has no roles or staff', () => {
    expect(getRoles(user([]))).toEqual([])
  })
})

describe('hasChiefAccess', () => {
  it('is true for admins and chiefs on any cycle', () => {
    expect(hasChiefAccess(user(['admin']))).toBe(true)
    expect(hasChiefAccess(user(['applicant'], [lead, chief]))).toBe(true)
  })

  it('is false for leads, applicants and signed-out users', () => {
    expect(hasChiefAccess(user(['applicant'], [lead]))).toBe(false)
    expect(hasChiefAccess(user(['applicant']))).toBe(false)
    expect(hasChiefAccess(undefined)).toBe(false)
  })
})

describe('hasReviewerAccess', () => {
  it('is true for admins and any staff', () => {
    expect(hasReviewerAccess(user(['admin']))).toBe(true)
    expect(hasReviewerAccess(user(['applicant'], [lead]))).toBe(true)
  })

  it('is false for plain applicants', () => {
    expect(hasReviewerAccess(user(['applicant']))).toBe(false)
  })
})

describe('defaultDashboard', () => {
  it('lands reviewers on the applicant Applications view', () => {
    expect(defaultDashboard(['reviewer'])).toBe('/applicant/applications')
    expect(defaultDashboard(['reviewer', 'admin'])).toBe(
      '/applicant/applications'
    )
  })

  it('lands admins and applicants on their own views', () => {
    expect(defaultDashboard(['admin'])).toBe('/admin/applications')
    expect(defaultDashboard(['applicant'])).toBe('/applicant/applications')
  })
})
