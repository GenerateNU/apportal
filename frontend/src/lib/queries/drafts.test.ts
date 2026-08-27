import { describe, expect, it } from 'vitest'
import type {
  DraftBoard,
  DraftPickDetail,
  DraftTeamDetail,
} from '@/lib/api/types'
import { patchDrafted, withOnTheClock } from './drafts'

function team(id: string, name: string, position: number): DraftTeamDetail {
  return {
    id,
    draft_id: 'd1',
    name,
    position,
    preference_list_id: `pl-${id}`,
    member_names: [],
  }
}

function pick(pickNumber: number, applicationId: string, teamId: string) {
  return {
    id: `p${pickNumber}`,
    draft_id: 'd1',
    draft_team_id: teamId,
    pick_number: pickNumber,
    application_id: applicationId,
    full_name: applicationId,
    email: `${applicationId}@northeastern.edu`,
    picked_at: '2026-01-01T00:00:00Z',
    picked_by: 'u1',
    previous_stage: 'selection',
  } satisfies DraftPickDetail
}

function board(picks: DraftPickDetail[], over: Partial<DraftBoard> = {}) {
  return {
    id: 'd1',
    cycle_id: 'c1',
    application_role: 'software_engineer',
    created_at: '2026-01-01T00:00:00Z',
    created_by: 'u1',
    updated_at: '2026-01-01T00:00:00Z',
    status: 'active',
    rounds: 2,
    on_the_clock: 0,
    teams: [
      team('t1', 'Alpha', 0),
      team('t2', 'Beta', 1),
      team('t3', 'Gamma', 2),
    ],
    picks,
    ...over,
  } as DraftBoard
}

// Mirrors TestNextOpenSlot in backend/internal/store/drafts_test.go — the
// server owns this rule, and a prediction that disagrees names the wrong team
// on the clock until the refetch corrects it.
describe('withOnTheClock', () => {
  it('opens on the first slot', () => {
    expect(withOnTheClock(board([])).on_the_clock).toBe(1)
  })

  it('advances to the next slot in order', () => {
    const picks = [pick(1, 'a', 't1'), pick(2, 'b', 't2'), pick(3, 'c', 't3')]
    expect(withOnTheClock(board(picks)).on_the_clock).toBe(4)
  })

  it('puts an undone slot back on the clock rather than the end', () => {
    const picks = [pick(1, 'a', 't1'), pick(3, 'c', 't3'), pick(4, 'd', 't3')]
    expect(withOnTheClock(board(picks)).on_the_clock).toBe(2)
  })

  it('clocks off a full board', () => {
    const picks = [1, 2, 3, 4, 5, 6].map((n) => pick(n, `a${n}`, 't1'))
    const next = withOnTheClock(board(picks))
    expect(next.on_the_clock).toBe(0)
    expect(next.on_the_clock_team_id).toBeUndefined()
  })

  it('clocks off a board that is not active', () => {
    expect(withOnTheClock(board([], { status: 'setup' })).on_the_clock).toBe(0)
  })

  // Round 2 runs back up the order, so slot 4 belongs to the last team, which
  // is what gives it back-to-back picks at the turn.
  it('names the team the snake puts on the clock', () => {
    expect(withOnTheClock(board([])).on_the_clock_team_id).toBe('t1')
    const throughRoundOne = [1, 2, 3].map((n) => pick(n, `a${n}`, 't1'))
    expect(withOnTheClock(board(throughRoundOne)).on_the_clock_team_id).toBe(
      't3'
    )
  })
})

describe('patchDrafted', () => {
  const before = board([pick(1, 'app-a', 't1')])

  it('marks a new pick as taken by the team that made it', () => {
    const after = board([pick(1, 'app-a', 't1'), pick(2, 'app-b', 't2')])
    expect(patchDrafted({ 'app-a': 'Alpha' }, before, after)).toEqual({
      'app-a': 'Alpha',
      'app-b': 'Beta',
    })
  })

  it('frees an applicant whose pick was undone', () => {
    expect(patchDrafted({ 'app-a': 'Alpha' }, before, board([]))).toEqual({})
  })

  it('swaps both sides of a replaced pick', () => {
    const after = board([pick(1, 'app-c', 't1')])
    expect(patchDrafted({ 'app-a': 'Alpha' }, before, after)).toEqual({
      'app-c': 'Alpha',
    })
  })

  // The map spans the cycle's other role too, so untouched entries survive.
  it('leaves the other board’s entries alone', () => {
    const after = board([pick(1, 'app-a', 't1'), pick(2, 'app-b', 't2')])
    const patched = patchDrafted(
      { 'app-a': 'Alpha', 'design-x': 'Delta' },
      before,
      after
    )
    expect(patched['design-x']).toBe('Delta')
  })
})
