import { describe, expect, it } from 'vitest'
import type { DecisionRow } from '@/lib/api/types'
import { feedbackState, isDecided } from './constants'

const base: DecisionRow = {
  application_id: 'a1',
  cycle_id: 'c1',
  application_role: 'software_engineer',
  applicant_nuid: '001',
  full_name: 'Dao Ho',
  email: 'dao@example.com',
  stage: 'interview_review',
  kind: 'rejection_post_interview',
  status: 'pending',
}

describe('feedbackState', () => {
  it('is unstarted when neither paragraph is written', () => {
    expect(feedbackState(base)).toBe('none')
  })

  it('is in progress once either paragraph has text', () => {
    expect(feedbackState({ ...base, feedback: 'half of it' })).toBe('draft')
    expect(feedbackState({ ...base, compliments: 'the other half' })).toBe(
      'draft'
    )
  })

  it('is done once the row leaves pending', () => {
    expect(feedbackState({ ...base, status: 'ready' })).toBe('submitted')
    expect(feedbackState({ ...base, status: 'sent' })).toBe('submitted')
  })

  // A no-interview rejection is ready the moment it exists, so it should never
  // sit in a lead's queue looking like unfinished work.
  it('counts a generic rejection as done', () => {
    expect(
      feedbackState({ ...base, kind: 'rejection_generic', status: 'ready' })
    ).toBe('submitted')
  })
})

describe('isDecided', () => {
  it('is true only once the applicant is actually rejected', () => {
    expect(isDecided('rejected')).toBe(true)
    expect(isDecided('interview_review')).toBe(false)
    expect(isDecided('selection')).toBe(false)
  })
})
