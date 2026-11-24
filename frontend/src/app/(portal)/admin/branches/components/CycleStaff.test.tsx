import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import type { CycleStaffMember } from '@/generated/model'
import type { Cycle } from '@/lib/api/types'
import { queryKeys } from '@/lib/queries/keys'
import { AddStaffButton, CycleStaffPanel } from './CycleStaff'

function cycle(applicationType: Cycle['application_type']): Cycle {
  return {
    id: 'c1',
    branch_id: 'b1',
    name: 'Fall 2026',
    status: 'open',
    application_type: applicationType,
    match_by_slot: false,
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
  it('lists the staff grouped by role', () => {
    const html = render('member', [ada])
    expect(html).toMatch(/Chiefs <span[^>]*>1<\/span>/)
    expect(html).toContain('Ada Chief')
    expect(html).toContain('aria-label="Remove Ada Chief"')
  })

  it('flags leads left on a lead cycle as having no access', () => {
    const lee: CycleStaffMember = {
      ...ada,
      user_nuid: '900000011',
      full_name: 'Lee Lead',
      role: 'lead',
    }
    const html = render('lead', [ada, lee])
    expect(html).toMatch(/Chiefs <span[^>]*>1<\/span>/)
    expect(html).toMatch(/Leads <span[^>]*>1<\/span>/)
    expect(html).toContain('No access: leads can’t see lead cycles')
    expect(html).toContain('aria-label="Remove Lee Lead"')
    expect(html.match(/No access/g)).toHaveLength(1)
  })

  it('says so when no one is on the cycle', () => {
    expect(render('member')).toContain('No one is on this cycle yet.')
  })
})

describe('AddStaffButton', () => {
  function button(applicationType: Cycle['application_type']) {
    return renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <AddStaffButton cycle={cycle(applicationType)} />
      </QueryClientProvider>
    )
  }

  it('offers adding people, closed until clicked', () => {
    const html = button('member')
    expect(html).toContain('Add people')
    expect(html).not.toContain('Person to add')
  })

  it('has nothing to add on a chief cycle', () => {
    expect(button('chief')).toBe('')
  })
})
