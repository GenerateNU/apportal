import { describe, expect, it } from 'vitest'
import { statusBlockedReason } from './status'

const ready = { hasQuestions: true, hasDeadline: true }

describe('statusBlockedReason', () => {
  it('holds reviews back until applications close', () => {
    for (const applications of ['draft', 'open'] as const) {
      expect(statusBlockedReason('review', 'open', applications, ready)).toBe(
        'Reviews open once applications close'
      )
    }
  })

  it('lets reviews open once applications have closed', () => {
    expect(statusBlockedReason('review', 'open', 'closed', ready)).toBeNull()
  })

  it('never blocks the other choices', () => {
    expect(statusBlockedReason('review', 'draft', 'open', ready)).toBeNull()
    expect(statusBlockedReason('review', 'closed', 'open', ready)).toBeNull()
    expect(
      statusBlockedReason('application', 'open', 'draft', ready)
    ).toBeNull()
  })

  it('holds an application back until the form is filled out', () => {
    expect(
      statusBlockedReason('application', 'open', 'draft', {
        hasQuestions: false,
        hasDeadline: true,
      })
    ).toBe('Fill out the form first')
    expect(
      statusBlockedReason('application', 'open', 'draft', {
        hasQuestions: false,
        hasDeadline: false,
      })
    ).toBe('Fill out the form and set a deadline first')
    expect(
      statusBlockedReason('application', 'open', 'draft', {
        hasQuestions: true,
        hasDeadline: false,
      })
    ).toBe('Set a deadline first')
  })
})
