import { describe, expect, it } from 'vitest'
import { defaultDashboard, getRoles } from './roles'

describe('getRoles', () => {
  it('makes anyone on a cycle’s staff a reviewer', () => {
    expect(getRoles({ roles: ['applicant'] }, true)).toEqual([
      'applicant',
      'reviewer',
    ])
    expect(getRoles({ roles: [] }, true)).toEqual(['reviewer'])
  })

  it('passes admin and applicant through directly', () => {
    expect(getRoles({ roles: ['admin'] })).toEqual(['admin'])
    expect(getRoles({ roles: ['applicant'] })).toEqual(['applicant'])
  })

  it('returns an empty array when the user has no roles or staff', () => {
    expect(getRoles({ roles: [] })).toEqual([])
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
