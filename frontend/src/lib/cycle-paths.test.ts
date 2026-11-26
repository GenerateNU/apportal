import { describe, expect, it } from 'vitest'
import { isNavItemActive } from '@/components/nav/NavItem'
import { cycleHref, cycleIdFromPath, toCycleTemplate } from './cycle-paths'

describe('cycleHref', () => {
  it('puts the cycle id into a template', () => {
    expect(cycleHref('c1', '/cycle/teams')).toBe('/cycles/c1/teams')
    expect(cycleHref('c1', '/cycle/teams/l1')).toBe('/cycles/c1/teams/l1')
    expect(cycleHref('c1', '/cycle/reviews?view=mine')).toBe(
      '/cycles/c1/reviews?view=mine'
    )
    expect(cycleHref('c1', '/cycle')).toBe('/cycles/c1')
  })

  it('leaves other paths alone', () => {
    expect(cycleHref('c1', '/my-work')).toBe('/my-work')
    expect(cycleHref('c1', '/cycles/c2/teams')).toBe('/cycles/c2/teams')
    expect(cycleHref('c1', '/cyclesomething')).toBe('/cyclesomething')
  })
})

describe('toCycleTemplate', () => {
  it('drops the cycle id', () => {
    expect(toCycleTemplate('/cycles/c1/teams/l1')).toBe('/cycle/teams/l1')
    expect(toCycleTemplate('/cycles/c1')).toBe('/cycle')
    expect(toCycleTemplate('/my-work')).toBe('/my-work')
  })
})

describe('cycleIdFromPath', () => {
  it('reads the id from a cycle path', () => {
    expect(cycleIdFromPath('/cycles/c1/teams')).toBe('c1')
    expect(cycleIdFromPath('/my-work')).toBeUndefined()
  })
})

describe('isNavItemActive', () => {
  it('matches templates against real cycle paths', () => {
    expect(isNavItemActive('/cycles/c1/teams/l1', '/cycle/teams')).toBe(true)
    expect(isNavItemActive('/cycles/c1/teams', '/cycles/c1/teams')).toBe(true)
    expect(isNavItemActive('/cycles/c1/teams', '/cycle/team')).toBe(false)
    expect(isNavItemActive('/cycles/c1/team', '/cycle/teams')).toBe(false)
  })
})
