import { describe, expect, it } from 'vitest'
import { staffHelpText, staffRolesFor } from './cycle-staff'

describe('staffRolesFor', () => {
  it('lets chiefs and leads staff member cycles', () => {
    expect(staffRolesFor('member')).toEqual(['chief', 'lead'])
  })

  it('lets only chiefs staff lead cycles', () => {
    expect(staffRolesFor('lead')).toEqual(['chief'])
  })

  it('leaves chief cycles to admins', () => {
    expect(staffRolesFor('chief')).toEqual([])
  })

  it('allows nobody on an unknown type', () => {
    expect(staffRolesFor('alumni')).toEqual([])
  })
})

describe('staffHelpText', () => {
  it('explains who reviews each type', () => {
    expect(staffHelpText('lead')).toContain('Chiefs run lead cycles')
    expect(staffHelpText('chief')).toContain('only admins')
  })
})
