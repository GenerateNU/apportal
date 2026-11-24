import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Branch, Cycle, CycleStatus, Role } from '@/lib/api/types'
import { BranchCard, branchColor } from './BranchCard'

const software: Branch = {
  id: 'b1',
  name: 'Software',
  created_at: '2026-11-01T00:00:00Z',
}

function cycle(id: string, status: CycleStatus): Cycle {
  return {
    id,
    branch_id: 'b1',
    name: id,
    status,
    application_type: 'member',
    match_by_slot: false,
    created_at: '2026-11-01T00:00:00Z',
  }
}

function role(name: string, cycleId: string): Role {
  return {
    id: name,
    cycle_id: cycleId,
    name,
    created_at: '2026-11-01T00:00:00Z',
  }
}

describe('BranchCard', () => {
  it('links to the branch page under a large heading', () => {
    const html = renderToStaticMarkup(
      <BranchCard branch={software} cycles={[]} roles={[]} colorIndex={0} />
    )
    expect(html).toContain('href="/admin/branches/b1"')
    expect(html).toMatch(/<h2[^>]*>Software<\/h2>/)
    expect(html).toContain('View cycles')
  })

  it('shows the branch roles as chips and counts its cycles', () => {
    const html = renderToStaticMarkup(
      <BranchCard
        branch={software}
        cycles={[
          cycle('a', 'open'),
          cycle('b', 'open'),
          cycle('c', 'closed'),
          cycle('d', 'archived'),
        ]}
        roles={[role('Web', 'a'), role('Mobile', 'c')]}
        colorIndex={0}
      />
    )
    expect(html).toMatch(/<li[^>]*>Mobile<\/li>/)
    expect(html).toMatch(/<li[^>]*>Web<\/li>/)
    expect(html).toMatch(/open<\/dt><dd[^>]*>2</)
    expect(html).toMatch(/draft<\/dt><dd[^>]*>0</)
    expect(html).toMatch(/closed<\/dt><dd[^>]*>1</)
  })

  it('leaves out the chip row when the branch has no roles', () => {
    const html = renderToStaticMarkup(
      <BranchCard branch={software} cycles={[]} roles={[]} colorIndex={0} />
    )
    expect(html).not.toContain('aria-label="Roles"')
  })
})

describe('branchColor', () => {
  it('rotates through the brand colors, starting with yellow', () => {
    expect(branchColor(0)).toBe('bg-gen-coral')
    expect(branchColor(4)).toBe('bg-gen-coral')
    expect(branchColor(1)).not.toBe(branchColor(0))
  })
})
