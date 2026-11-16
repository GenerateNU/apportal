import { describe, expect, it } from 'vitest'
import { askToOverride, overrideRequest, setOverrideAsker } from './override'

describe('overrideRequest', () => {
  const body = (location: string, value = 'destructive') => ({
    status: 409,
    detail: 'destructive change needs confirmation: reviews are released',
    errors: [{ location, message: 'reviews are released', value }],
  })

  it('reads the level and reason of an override the caller may confirm', () => {
    expect(overrideRequest(409, body('query.confirm_override'))).toEqual({
      level: 'destructive',
      reason: 'reviews are released',
    })
    expect(
      overrideRequest(409, body('query.confirm_override', 'override'))?.level
    ).toBe('override')
  })

  it('ignores other conflicts and statuses', () => {
    expect(overrideRequest(409, body('body.name'))).toBeNull()
    expect(overrideRequest(403, body('query.confirm_override'))).toBeNull()
    expect(overrideRequest(409, 'conflict')).toBeNull()
  })

  it('declines when nothing can ask', async () => {
    setOverrideAsker(undefined)
    await expect(
      askToOverride({ level: 'override', reason: '' })
    ).resolves.toBe(false)
  })
})
