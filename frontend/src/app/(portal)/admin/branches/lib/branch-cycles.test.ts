import { describe, expect, it } from 'vitest'
import type { Cycle, CycleStatus, Role } from '@/lib/api/types'
import { branchRoleNames, groupCyclesByStatus } from './branch-cycles'

function cycle(id: string, status: CycleStatus): Cycle {
  return {
    id,
    branch_id: 'b1',
    name: id,
    status,
    application_type: 'member',
    created_at: '2026-11-01T00:00:00Z',
  }
}

describe('groupCyclesByStatus', () => {
  it('splits cycles into open, draft and closed, keeping their order', () => {
    const groups = groupCyclesByStatus([
      cycle('a', 'closed'),
      cycle('b', 'open'),
      cycle('c', 'draft'),
      cycle('d', 'closed'),
    ])
    expect(groups.open.map((c) => c.id)).toEqual(['b'])
    expect(groups.draft.map((c) => c.id)).toEqual(['c'])
    expect(groups.closed.map((c) => c.id)).toEqual(['a', 'd'])
  })

  it('leaves archived cycles out', () => {
    const groups = groupCyclesByStatus([cycle('a', 'archived')])
    expect(groups).toEqual({ open: [], draft: [], closed: [] })
  })
})

describe('branchRoleNames', () => {
  it('lists unique role names from non-archived cycles, sorted', () => {
    const role = (id: string, cycleId: string, name: string): Role => ({
      id,
      cycle_id: cycleId,
      name,
      created_at: '2026-11-01T00:00:00Z',
    })
    const names = branchRoleNames(
      [cycle('a', 'open'), cycle('b', 'closed'), cycle('c', 'archived')],
      [
        role('r1', 'a', 'Web'),
        role('r2', 'b', 'Web'),
        role('r3', 'b', 'Brand'),
        role('r4', 'c', 'DevOps'),
        role('r5', 'other', 'Mobile'),
      ]
    )
    expect(names).toEqual(['Brand', 'Web'])
  })
})
