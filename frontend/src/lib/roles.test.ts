import { describe, expect, it } from 'vitest'
import type { Cycle, Role } from '@/lib/api/types'
import {
  buildRoleLookup,
  cycleRoleIds,
  defaultRoleId,
  resolvePickedRole,
  resolveRoleFilter,
  ROLE_CHIP_CLASSES,
  withCycleNames,
} from './roles'

const role = (id: string, cycle_id: string, name: string): Role => ({
  id,
  cycle_id,
  name,
  created_at: '2026-11-14T00:00:00Z',
})

const roles = [
  role('swe', 'spring', 'Software Engineer'),
  role('sd', 'spring', 'Software Designer'),
  role('ux', 'design', 'UX Designer'),
]

describe('buildRoleLookup', () => {
  it('labels roles by id and falls back for unknown ones', () => {
    const lookup = buildRoleLookup(roles)
    expect(lookup.roleLabel('sd')).toBe('Software Designer')
    expect(lookup.roleLabel('missing')).toBe('Unknown role')
  })

  it('colours roles by their position within their cycle', () => {
    const lookup = buildRoleLookup(roles)
    expect(lookup.roleChipClass('swe')).toBe(ROLE_CHIP_CLASSES[0])
    expect(lookup.roleChipClass('sd')).toBe(ROLE_CHIP_CLASSES[1])
    expect(lookup.roleChipClass('ux')).toBe(ROLE_CHIP_CLASSES[0])
  })

  it('wraps the palette when a cycle has more roles than colours', () => {
    const many = Array.from({ length: ROLE_CHIP_CLASSES.length + 1 }, (_, i) =>
      role(`r${i}`, 'b', `Role ${i}`)
    )
    const lookup = buildRoleLookup(many)
    expect(lookup.roleChipClass(`r${ROLE_CHIP_CLASSES.length}`)).toBe(
      ROLE_CHIP_CLASSES[0]
    )
  })

  it('narrows to one cycle, keeping order', () => {
    const lookup = buildRoleLookup(roles, 'spring')
    expect(lookup.roleIds).toEqual(['swe', 'sd'])
    expect(lookup.roles.map((r) => r.name)).toEqual([
      'Software Engineer',
      'Software Designer',
    ])
    // Labels still resolve roles outside the cycle.
    expect(lookup.roleLabel('ux')).toBe('UX Designer')
  })
})

describe('resolvePickedRole', () => {
  it('keeps a pick that belongs to the roles', () => {
    expect(resolvePickedRole('sd', ['swe', 'sd'])).toBe('sd')
  })

  it('falls back to the first role for a missing or foreign pick', () => {
    expect(resolvePickedRole(undefined, ['swe', 'sd'])).toBe('swe')
    expect(resolvePickedRole('ux', ['swe', 'sd'])).toBe('swe')
  })

  it('is empty while there are no roles', () => {
    expect(resolvePickedRole('sd', [])).toBe('')
  })
})

describe('resolveRoleFilter', () => {
  it('keeps all and roles in the list', () => {
    expect(resolveRoleFilter('all', ['swe'], false)).toBe('all')
    expect(resolveRoleFilter('swe', ['swe'], false)).toBe('swe')
  })

  it('falls back to all for a role outside the list', () => {
    expect(resolveRoleFilter('ux', ['swe'], false)).toBe('all')
  })

  it('keeps the pick while roles are loading', () => {
    expect(resolveRoleFilter('ux', [], true)).toBe('ux')
  })
})

describe('cycleRoleIds / defaultRoleId', () => {
  it('lists a cycle’s role ids in order, first as the default', () => {
    expect(cycleRoleIds(roles, 'spring')).toEqual(['swe', 'sd'])
    expect(defaultRoleId(roles, 'spring')).toBe('swe')
  })

  it('has no default for a cycle without roles', () => {
    expect(cycleRoleIds(roles, 'none')).toEqual([])
    expect(defaultRoleId(roles, 'none')).toBeUndefined()
  })
})

describe('withCycleNames', () => {
  const cycle = (id: string, name: string) => ({ id, name }) as Cycle

  it('adds the cycle name so same-named roles stay distinct', () => {
    const lookup = withCycleNames(
      buildRoleLookup([
        ...roles,
        role('swe-fall', 'fall', 'Software Engineer'),
      ]),
      [cycle('spring', 'Spring 2027'), cycle('fall', 'Fall 2026')]
    )
    expect(lookup.roleLabel('swe')).toBe('Software Engineer · Spring 2027')
    expect(lookup.roleLabel('swe-fall')).toBe('Software Engineer · Fall 2026')
  })

  it('leaves the plain name while the cycle is unknown', () => {
    const lookup = withCycleNames(buildRoleLookup(roles), [])
    expect(lookup.roleLabel('sd')).toBe('Software Designer')
  })
})
