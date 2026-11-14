import { describe, expect, it } from 'vitest'
import type { Branch, Cycle } from '@/lib/api/types'
import { groupCyclesByBranch } from './group-cycles'

function branch(id: string, name: string): Branch {
  return { id, name, created_at: '2026-11-01T00:00:00Z' }
}

function cycle(id: string, branchId: string): Cycle {
  return {
    id,
    branch_id: branchId,
    name: id,
    status: 'draft',
    application_type: 'member',
    created_at: '2026-11-01T00:00:00Z',
  }
}

describe('groupCyclesByBranch', () => {
  it('puts each cycle under its branch, keeping both orders', () => {
    const groups = groupCyclesByBranch(
      [branch('b1', 'Design'), branch('b2', 'Software')],
      [cycle('c1', 'b2'), cycle('c2', 'b1'), cycle('c3', 'b2')]
    )
    expect(groups.map((g) => g.branch.id)).toEqual(['b1', 'b2'])
    expect(groups[0].cycles.map((c) => c.id)).toEqual(['c2'])
    expect(groups[1].cycles.map((c) => c.id)).toEqual(['c1', 'c3'])
  })

  it('keeps branches that have no cycles yet', () => {
    const groups = groupCyclesByBranch([branch('b1', 'Design')], [])
    expect(groups).toEqual([{ branch: branch('b1', 'Design'), cycles: [] }])
  })
})
