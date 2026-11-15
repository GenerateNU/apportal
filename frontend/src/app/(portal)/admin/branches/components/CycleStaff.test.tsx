import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import type { CycleStaffMember } from '@/generated/model'
import type { Cycle } from '@/lib/api/types'
import { queryKeys } from '@/lib/queries/keys'
import { CycleStaffButton, CycleStaffPanel } from './CycleStaff'

function cycle(applicationType: Cycle['application_type']): Cycle {
  return {
    id: 'c1',
    branch_id: 'b1',
    name: 'Fall 2026',
    status: 'open',
    application_type: applicationType,
    created_at: '2026-11-01T00:00:00Z',
  }
}

const ada: CycleStaffMember = {
  user_nuid: '900000001',
  full_name: 'Ada Chief',
  email: 'ada@example.com',
  role: 'chief',
  created_at: '2026-11-01T00:00:00Z',
}

function render(
  applicationType: Cycle['application_type'],
  staff: CycleStaffMember[] = []
) {
  const client = new QueryClient()
  client.setQueryData(queryKeys.cycleStaff.list('c1'), staff)
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <CycleStaffPanel cycle={cycle(applicationType)} />
    </QueryClientProvider>
  )
}

describe('CycleStaffPanel', () => {
  it('lists the staff with a way to add more', () => {
    const html = render('member', [ada])
    expect(html).toContain('Ada Chief')
    expect(html).toContain('aria-label="Person to add"')
    expect(html).toContain('aria-label="Remove Ada Chief"')
  })

  it('only adds chiefs to a lead cycle', () => {
    const html = render('lead')
    expect(html).toContain('as Chief')
  })

  it('flags leads left on a lead cycle as having no access', () => {
    const lee: CycleStaffMember = {
      ...ada,
      user_nuid: '900000011',
      full_name: 'Lee Lead',
      role: 'lead',
    }
    const html = render('lead', [ada, lee])
    expect(html).toContain('On this cycle · 2')
    expect(html).toContain('No access — leads can’t see lead cycles')
    expect(html).toContain('aria-label="Remove Lee Lead"')
    expect(html.match(/No access/g)).toHaveLength(1)
  })

  it('has no add form on a chief cycle', () => {
    const html = render('chief')
    expect(html).not.toContain('Person to add')
  })
})

describe('CycleStaffButton', () => {
  it('shows the staff count and keeps the panel closed until clicked', () => {
    const client = new QueryClient()
    client.setQueryData(queryKeys.cycleStaff.list('c1'), [ada])
    const html = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <CycleStaffButton cycle={cycle('member')} />
      </QueryClientProvider>
    )
    expect(html).toContain('Leads &amp; chiefs · 1')
    expect(html).not.toContain('Person to add')
  })
})
