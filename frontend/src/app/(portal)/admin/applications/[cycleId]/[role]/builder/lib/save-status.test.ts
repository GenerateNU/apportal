import { describe, expect, it } from 'vitest'
import {
  INITIAL_SAVE_STATE,
  saveStatus,
  saveReducer,
  type SaveEvent,
} from './save-status'

function run(...events: SaveEvent[]) {
  return events.reduce(saveReducer, INITIAL_SAVE_STATE)
}

describe('saveStatus', () => {
  it('says nothing before the first edit', () => {
    expect(saveStatus(INITIAL_SAVE_STATE)).toBe('idle')
  })

  it('shows saving while any save is in flight', () => {
    expect(saveStatus(run({ type: 'start' }))).toBe('saving')
    expect(
      saveStatus(run({ type: 'start' }, { type: 'start' }, { type: 'success' }))
    ).toBe('saving')
  })

  it('shows saved once everything lands', () => {
    expect(saveStatus(run({ type: 'start' }, { type: 'success' }))).toBe(
      'saved'
    )
  })

  it('keeps a failure up until a later save succeeds', () => {
    const failed = run({ type: 'start' }, { type: 'failure' })
    expect(saveStatus(failed)).toBe('error')
    expect(saveStatus(saveReducer(failed, { type: 'start' }))).toBe('saving')
    expect(
      saveStatus(
        run(
          { type: 'start' },
          { type: 'failure' },
          { type: 'start' },
          { type: 'success' }
        )
      )
    ).toBe('saved')
  })
})
