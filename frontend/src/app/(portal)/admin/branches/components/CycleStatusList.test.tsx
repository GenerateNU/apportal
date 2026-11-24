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
  match_by_slot: false,
  created_at: '2026-11-01T00:00:00Z',
}

describe('CycleStatusList', () => {
  it('lists each cycle under a heading with the count', () => {
    const html = render(
      <CycleStatusList status="open" cycles={[fall]} roles={[]} />
    )
    expect(html).toMatch(/Open cycles <span[^>]*>1<\/span>/)
    expect(html).toContain('Fall 2026')
  })

  it('gives open and draft cycles the prominent heading and closed a quiet label', () => {
    const open = render(
      <CycleStatusList status="open" cycles={[fall]} roles={[]} />
    )
    const draft = render(
      <CycleStatusList status="draft" cycles={[fall]} roles={[]} />
    )
    const closed = render(
      <CycleStatusList status="closed" cycles={[fall]} roles={[]} />
    )
    expect(open).toContain('Cycles taking applications')
    expect(draft).toContain('Cycles still being set up')
    expect(closed).not.toContain('Cycles still being set up')
    expect(closed).toContain('border-t')
  })

  it('shows an empty state when there are no cycles', () => {
    const html = render(
      <CycleStatusList status="draft" cycles={[]} roles={[]} />
    )
    expect(html).toContain('No draft cycles in this branch.')
  })
})
