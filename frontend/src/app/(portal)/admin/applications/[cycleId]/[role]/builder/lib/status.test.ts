import { describe, expect, it } from 'vitest'
import { statusBlockedReason } from './status'

describe('statusBlockedReason', () => {
  it('holds reviews back until applications close', () => {
    for (const applications of ['draft', 'open'] as const) {
      expect(statusBlockedReason('review', 'open', applications)).toBe(
        'Reviews open once applications close'
      )
    }
  })

  it('lets reviews open once applications have closed', () => {
    expect(statusBlockedReason('review', 'open', 'closed')).toBeNull()
  })

  it('never blocks the other choices', () => {
    expect(statusBlockedReason('review', 'draft', 'open')).toBeNull()
    expect(statusBlockedReason('review', 'closed', 'open')).toBeNull()
    expect(statusBlockedReason('application', 'open', 'draft')).toBeNull()
  })
})
