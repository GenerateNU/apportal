import { describe, expect, it } from 'vitest'
import { isAdmin, withAdmin, withoutAdmin } from './role-meta'

describe('isAdmin', () => {
  it('checks for the admin role', () => {
    expect(isAdmin(['applicant', 'admin'])).toBe(true)
    expect(isAdmin(['applicant'])).toBe(false)
    expect(isAdmin([])).toBe(false)
  })
})

describe('withAdmin', () => {
  it('adds admin and keeps their other roles', () => {
    expect(withAdmin(['applicant'])).toEqual(['applicant', 'admin'])
  })

  it('leaves an existing admin unchanged', () => {
    expect(withAdmin(['admin', 'applicant'])).toEqual(['admin', 'applicant'])
  })
})

describe('withoutAdmin', () => {
  it('removes admin and keeps their other roles', () => {
    expect(withoutAdmin(['applicant', 'admin'])).toEqual(['applicant'])
  })

  it('falls back to applicant rather than leaving no roles', () => {
    expect(withoutAdmin(['admin'])).toEqual(['applicant'])
  })
})
