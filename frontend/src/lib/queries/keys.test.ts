import { describe, expect, it } from 'vitest'
import { queryKeys } from './keys'

describe('queryKeys', () => {
  it('nests list keys under their entity so partial keys invalidate children', () => {
    expect(queryKeys.applications.list({ cycle_id: 'c1' })).toEqual([
      'applications',
      'list',
      { cycle_id: 'c1' },
    ])
    // A detail key shares the entity root but a different sub-namespace.
    expect(queryKeys.applications.detail('a1')).toEqual([
      'applications',
      'detail',
      'a1',
    ])
  })

  it('defaults an omitted list filter to a stable empty object', () => {
    expect(queryKeys.applications.list()).toEqual(['applications', 'list', {}])
  })

  it('defaults an omitted role to "any" for question keys', () => {
    expect(queryKeys.questions.list('cycle-1')).toEqual([
      'questions',
      'list',
      'cycle-1',
      'any',
    ])
    expect(queryKeys.questions.list('cycle-1', 'software_engineer')).toEqual([
      'questions',
      'list',
      'cycle-1',
      'software_engineer',
    ])
  })

  it('keeps user detail and me keys distinct', () => {
    expect(queryKeys.users.detail('001')).not.toEqual(
      queryKeys.users.me('uid-1')
    )
  })

  it('gives each signed-in identity its own me key', () => {
    expect(queryKeys.users.me('uid-1')).not.toEqual(queryKeys.users.me('uid-2'))
  })

  it('nests branch list and detail keys under the branches root', () => {
    expect(queryKeys.branches.list()).toEqual(['branches', 'list'])
    expect(queryKeys.branches.detail('b1')).toEqual([
      'branches',
      'detail',
      'b1',
    ])
  })

  it('keys cycle lists by branch so each branch caches separately', () => {
    expect(queryKeys.cycles.list({ branch_id: 'b1' })).not.toEqual(
      queryKeys.cycles.list({ branch_id: 'b2' })
    )
  })
})
