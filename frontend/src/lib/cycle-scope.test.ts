import { describe, expect, it } from 'vitest'
import type { Cycle } from '@/lib/api/types'
import { scopeCycles } from './cycle-scope'

function cycle(
  id: string,
  application_type: Cycle['application_type'],
  status: Cycle['status'] = 'open'
): Cycle {
  return {
    id,
    branch_id: 'b',
    name: id,
    status,
    application_type,
    match_by_slot: false,
    created_at: '2026-11-01T00:00:00Z',
  }
}

const member = cycle('m', 'member')
const lead = cycle('l', 'lead')
const chief = cycle('c', 'chief')
const closed = cycle('x', 'member', 'closed')
const all = [member, lead, chief, closed]
const none = { isAdmin: false, staffCycleIds: [], chiefCycleIds: [] }

describe('scopeCycles', () => {
  it('gives admins every cycle that isn’t closed, in either mode', () => {
    const admin = { ...none, isAdmin: true }
    expect(scopeCycles(all, admin, 'lead')).toEqual([member, lead, chief])
    expect(scopeCycles(all, admin, 'chief')).toEqual([member, lead, chief])
  })

  it('gives staff only the cycles they are on', () => {
    const staff = { ...none, staffCycleIds: ['m', 'l'], chiefCycleIds: ['l'] }
    expect(scopeCycles(all, staff, 'lead')).toEqual([member, lead])
    expect(scopeCycles(all, staff, 'chief')).toEqual([lead])
  })

  it('never offers a closed cycle, even to its staff', () => {
    const staff = { ...none, staffCycleIds: ['x'], chiefCycleIds: ['x'] }
    expect(scopeCycles(all, staff, 'lead')).toEqual([])
    expect(scopeCycles(all, staff, 'chief')).toEqual([])
  })
})
