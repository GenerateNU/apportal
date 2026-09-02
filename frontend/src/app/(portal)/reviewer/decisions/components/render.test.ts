import { describe, expect, it } from 'vitest'
import type { DecisionRow, DecisionTemplate } from '@/lib/api/types'
import { fillTemplate, renderDecision } from './render'

const template: DecisionTemplate = {
  id: 't1',
  cycle_id: 'c1',
  application_role: 'software_engineer',
  kind: 'rejection_post_interview',
  subject: 'Generate — {{cycle}} {{role}} Application Update',
  body: 'Dear {{applicant_name}},\n\nTo shed some light, {{feedback}} That said, {{compliments}}',
  created_at: '',
  updated_at: '',
}

const row: DecisionRow = {
  application_id: 'a1',
  cycle_id: 'c1',
  application_role: 'software_engineer',
  applicant_nuid: '001',
  full_name: 'Dao Ho',
  email: 'dao@example.com',
  stage: 'rejected',
  kind: 'rejection_post_interview',
  status: 'ready',
  feedback: 'the technical depth was thinner than the pool.',
  compliments: 'your work on the scheduler.',
}

describe('fillTemplate', () => {
  it('fills every occurrence of a placeholder', () => {
    expect(fillTemplate('{{role}} and {{role}}', { role: 'SWE' })).toBe(
      'SWE and SWE'
    )
  })

  it('tolerates whitespace inside the braces', () => {
    expect(fillTemplate('{{ role }}', { role: 'SWE' })).toBe('SWE')
  })

  it('leaves an unknown placeholder visible rather than blanking it', () => {
    expect(fillTemplate('Hi {{nickname}}', {})).toBe('Hi {{nickname}}')
  })

  it('marks a known but unwritten paragraph', () => {
    expect(fillTemplate('{{feedback}}', {})).toBe('[feedback needed]')
  })
})

describe('renderDecision', () => {
  it('renders the whole message from the template and the row', () => {
    const { subject, body, missing } = renderDecision(
      row,
      template,
      'Fall 2026'
    )

    expect(subject).toBe(
      'Generate — Fall 2026 Software Engineer Application Update'
    )
    expect(body).toContain('Dear Dao,')
    expect(body).toContain('the technical depth was thinner than the pool.')
    expect(body).toContain('your work on the scheduler.')
    expect(missing).toEqual([])
  })

  it('reports the paragraphs the interviewer still owes', () => {
    const pending = { ...row, feedback: undefined, compliments: undefined }
    const { body, missing } = renderDecision(pending, template, 'Fall 2026')

    expect(body).toContain('[feedback needed]')
    expect(missing).toEqual(['feedback', 'compliments'])
  })

  it('does not report a paragraph the template never asks for', () => {
    const generic: DecisionTemplate = {
      ...template,
      kind: 'rejection_generic',
      body: 'Dear {{applicant_name}},\n\nAfter careful review…',
    }
    const pending = { ...row, feedback: undefined, compliments: undefined }

    expect(renderDecision(pending, generic, 'Fall 2026').missing).toEqual([])
  })

  it('fills placeholders inside a hand-written override', () => {
    const overridden = { ...row, body_override: 'Dear {{applicant_name}}, no.' }

    expect(renderDecision(overridden, template, 'Fall 2026').body).toBe(
      'Dear Dao, no.'
    )
  })

  it('leaves a one-word name alone', () => {
    const mononym = { ...row, full_name: 'Prince' }

    expect(renderDecision(mononym, template, 'Fall 2026').body).toContain(
      'Dear Prince,'
    )
  })
})
