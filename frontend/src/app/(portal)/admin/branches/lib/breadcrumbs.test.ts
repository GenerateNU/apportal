import { describe, expect, it } from 'vitest'
import type { Branch, Cycle } from '@/lib/api/types'
import { applicationFormHref, branchCrumbs, branchPathIds } from './breadcrumbs'

const software: Branch = {
  id: 'b1',
  name: 'Software',
  created_at: '2026-11-01T00:00:00Z',
}

const fall: Cycle = {
  id: 'c1',
  branch_id: 'b1',
  name: 'Fall 2026',
  status: 'open',
  application_type: 'member',
  created_at: '2026-11-01T00:00:00Z',
}

describe('branchCrumbs', () => {
  it('is just Branches on the branches page', () => {
    expect(branchCrumbs({})).toEqual([
      { label: 'Branches', href: '/admin/branches' },
    ])
  })

  it('adds the branch on its page', () => {
    expect(branchCrumbs({ branchId: 'b1', branch: software })).toEqual([
      { label: 'Branches', href: '/admin/branches' },
      { label: 'Software', href: '/admin/branches/b1' },
    ])
  })

  it('adds the cycle, unlinked, on its page', () => {
    expect(
      branchCrumbs({
        branchId: 'b1',
        branch: software,
        cycle: fall,
        showCycle: true,
      })
    ).toEqual([
      { label: 'Branches', href: '/admin/branches' },
      { label: 'Software', href: '/admin/branches/b1' },
      { label: 'Fall 2026', href: undefined },
    ])
  })

  it('links the cycle and ends on the form on a form page', () => {
    expect(
      branchCrumbs({
        branchId: 'b1',
        branch: software,
        cycle: fall,
        showCycle: true,
        formLabel: 'Web',
      })
    ).toEqual([
      { label: 'Branches', href: '/admin/branches' },
      { label: 'Software', href: '/admin/branches/b1' },
      { label: 'Fall 2026', href: '/admin/branches/b1/cycles/c1' },
      { label: 'Web' },
    ])
  })

  it('falls back to placeholders while names are missing', () => {
    expect(branchCrumbs({ branchId: 'b1', showCycle: true })).toEqual([
      { label: 'Branches', href: '/admin/branches' },
      { label: 'Branch', href: '/admin/branches/b1' },
      { label: 'Cycle', href: undefined },
    ])
  })
})

describe('applicationFormHref', () => {
  it('nests the form under its branch and cycle', () => {
    expect(applicationFormHref('b1', 'c1', 'r1')).toBe(
      '/admin/branches/b1/cycles/c1/applications/r1'
    )
  })
})

describe('branchPathIds', () => {
  it('reads each level of the path', () => {
    expect(branchPathIds('/admin/branches')).toEqual({})
    expect(branchPathIds('/admin/branches/b1')).toEqual({ branchId: 'b1' })
    expect(branchPathIds('/admin/branches/b1/cycles/c1')).toEqual({
      branchId: 'b1',
      cycleId: 'c1',
    })
    expect(
      branchPathIds('/admin/branches/b1/cycles/c1/applications/r1')
    ).toEqual({ branchId: 'b1', cycleId: 'c1', roleId: 'r1' })
  })

  it('ignores unknown segments', () => {
    expect(branchPathIds('/admin/branches/b1/other/c1')).toEqual({
      branchId: 'b1',
    })
  })
})
