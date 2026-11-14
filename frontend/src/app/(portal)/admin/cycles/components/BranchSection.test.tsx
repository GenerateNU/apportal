import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import type { Branch, Cycle, Role } from '@/lib/api/types'
import { BranchSection } from './BranchSection'

// Static markup only — no DOM here, so this covers structure, not clicks.
function render(node: ReactNode) {
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>
  )
}

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

const engineer: Role = {
  id: 'r1',
  cycle_id: 'c1',
  name: 'Software Engineer',
  created_at: '2026-11-01T00:00:00Z',
}

describe('BranchSection', () => {
  it('shows the branch name and its cycles', () => {
    const html = render(
      <BranchSection branch={software} cycles={[fall]} roles={[]} />
    )
    expect(html).toContain('Software')
    expect(html).toContain('Fall 2026')
    expect(html).toContain('New cycle')
  })

  it('shows an empty state when the branch has no cycles', () => {
    const html = render(
      <BranchSection branch={software} cycles={[]} roles={[]} />
    )
    expect(html).toContain('No cycles in this branch yet')
  })

  it('lists each cycle’s roles on its row, with an add button', () => {
    const html = render(
      <BranchSection branch={software} cycles={[fall]} roles={[engineer]} />
    )
    expect(html).toContain('Software Engineer')
    expect(html).toContain('Edit Software Engineer')
    expect(html).toContain('Add role')
  })

  it('leaves out roles from other cycles', () => {
    const other = { ...engineer, id: 'r2', cycle_id: 'c9', name: 'Tech Lead' }
    const html = render(
      <BranchSection branch={software} cycles={[fall]} roles={[other]} />
    )
    expect(html).not.toContain('Tech Lead')
    expect(html).toContain('None yet')
  })
})
