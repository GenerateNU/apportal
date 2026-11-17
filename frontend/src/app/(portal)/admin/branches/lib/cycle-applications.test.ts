import { describe, expect, it } from 'vitest'
import type { ApplicationTemplate, Cycle } from '@/lib/api/types'
import { cycleApplicationCards } from './cycle-applications'

const fall: Cycle = {
  id: 'c1',
  branch_id: 'b1',
  name: 'Fall 2026',
  status: 'open',
  application_type: 'member',
  match_by_slot: false,
  created_at: '2026-11-01T00:00:00Z',
}

function template(roleId: string, title: string): ApplicationTemplate {
  return {
    id: `t-${roleId}`,
    cycle_id: 'c1',
    role_id: roleId,
    title,
    status: 'draft',
    review_status: 'draft',
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
  }
}

describe('cycleApplicationCards', () => {
  it('makes one card per template, in order, with that role’s counts', () => {
    const cards = cycleApplicationCards(
      fall,
      [template('r2', 'Mobile Application'), template('r1', 'Web Application')],
      [
        {
          role_id: 'r1',
          cycle_id: fall.id,
          title: 'Web Application',
          status: 'open',
          question_count: 4,
          challenge_count: 1,
          submission_count: 9,
          script_questions: 0,
          script_written: false,
        },
      ]
    )
    expect(cards.map((c) => c.title)).toEqual([
      'Mobile Application',
      'Web Application',
    ])
    expect(cards[1]).toMatchObject({
      cycleId: 'c1',
      role: 'r1',
      status: 'draft',
      questionCount: 4,
      challengeCount: 1,
      submissionCount: 9,
    })
  })

  it('shows zero counts when a role has no summary yet', () => {
    const [card] = cycleApplicationCards(
      fall,
      [template('r1', 'Web Application')],
      []
    )
    expect(card).toMatchObject({
      questionCount: 0,
      challengeCount: 0,
      submissionCount: 0,
    })
  })
})
