import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { ToastProvider } from '@/components/ui/toast'
import type { Cycle } from '@/lib/api/types'
import { CycleStatusList } from './CycleStatusList'

function render(node: ReactNode) {
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>{node}</ToastProvider>
    </QueryClientProvider>
  )
}

const fall: Cycle = {
  id: 'c1',
  branch_id: 'b1',
  name: 'Fall 2026',
  status: 'open',
  application_type: 'member',
  created_at: '2026-11-01T00:00:00Z',
}

describe('CycleStatusList', () => {
  it('lists each cycle under a heading with the count', () => {
    const html = render(
      <CycleStatusList status="open" cycles={[fall]} roles={[]} />
    )
    expect(html).toContain('Open cycles · 1')
    expect(html).toContain('Fall 2026')
  })

  it('wraps the group in a dashed border', () => {
    const html = render(
      <CycleStatusList status="open" cycles={[fall]} roles={[]} />
    )
    expect(html).toContain('border-dashed')
  })

  it('shows an empty state when there are no cycles', () => {
    const html = render(
      <CycleStatusList status="draft" cycles={[]} roles={[]} />
    )
    expect(html).toContain('No draft cycles in this branch.')
  })
})
