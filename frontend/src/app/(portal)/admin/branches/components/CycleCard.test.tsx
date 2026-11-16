import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { ToastProvider } from '@/components/ui/toast'
import type { Cycle, Role } from '@/lib/api/types'
import { CycleCard } from './CycleCard'

const fall: Cycle = {
  id: 'c1',
  branch_id: 'b1',
  name: 'Fall 2026',
  status: 'draft',
  application_type: 'lead',
  match_by_slot: false,
  created_at: '2026-11-01T00:00:00Z',
}

const web: Role = {
  id: 'r1',
  cycle_id: 'c1',
  name: 'Web',
  created_at: '2026-11-01T00:00:00Z',
}

function render(roles: Role[]) {
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <CycleCard cycle={fall} roles={roles} />
      </ToastProvider>
    </QueryClientProvider>
  )
}

describe('CycleCard', () => {
  it('shows the name, status, type and an edit button', () => {
    const html = render([])
    expect(html).toContain('aria-label="Edit Fall 2026"')
    expect(html).toMatch(/<h3[^>]*><a[^>]*>Fall 2026<\/a><\/h3>/)
    expect(html).toContain('Draft')
    expect(html).toContain('Lead cycle')
  })

  it('links to the cycle page', () => {
    expect(render([])).toContain('href="/admin/branches/b1/cycles/c1"')
  })

  it('lists the cycle roles without an add button', () => {
    const html = render([web])
    expect(html).toContain('Edit Web')
    expect(html).not.toContain('Add role')
  })
})
