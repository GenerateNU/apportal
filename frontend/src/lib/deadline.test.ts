import { describe, expect, it } from 'vitest'
import { formatDeadline, timeLeft } from './deadline'

const now = new Date('2026-11-15T12:00:00Z')

describe('timeLeft', () => {
  it('counts days ahead', () => {
    expect(timeLeft(new Date('2026-11-25T12:00:00Z'), now)).toEqual({
      text: 'in 10 days',
      passed: false,
      soon: false,
    })
  })

  it('flags the last two days', () => {
    const left = timeLeft(new Date('2026-11-16T08:00:00Z'), now)
    expect(left.soon).toBe(true)
    expect(left.text).toBe('in 20 hours')
  })

  it('says when it already closed', () => {
    const left = timeLeft(new Date('2026-11-13T12:00:00Z'), now)
    expect(left).toEqual({
      text: 'Closed 2 days ago',
      passed: true,
      soon: false,
    })
  })
})

describe('formatDeadline', () => {
  it('includes the timezone', () => {
    expect(formatDeadline(now)).toMatch(/[A-Z]{2,5}|GMT/)
  })
})
