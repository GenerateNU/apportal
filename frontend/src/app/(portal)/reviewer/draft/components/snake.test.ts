import { describe, expect, it } from 'vitest'
import { roundOf, snakeSeat } from './snake'

// Mirrors TestSnakePosition in backend/internal/store/drafts_test.go — the
// server decides which team owns a pick, and the board has to label it the
// same way or the grid disagrees with the picks in it.
describe('snakeSeat', () => {
  it('runs down the order, then back up it', () => {
    const seats = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => snakeSeat(n, 3))
    expect(seats).toEqual([0, 1, 2, 2, 1, 0, 0, 1, 2])
  })

  it('gives the last seat back-to-back picks at the turn', () => {
    expect(snakeSeat(3, 3)).toBe(2)
    expect(snakeSeat(4, 3)).toBe(2)
  })

  it('stays put with one team', () => {
    expect([1, 2, 3].map((n) => snakeSeat(n, 1))).toEqual([0, 0, 0])
  })

  it('guards empty boards', () => {
    expect(snakeSeat(1, 0)).toBe(0)
    expect(snakeSeat(0, 3)).toBe(0)
  })
})

describe('roundOf', () => {
  it('counts a round per trip around the order', () => {
    expect([1, 3, 4, 6, 7].map((n) => roundOf(n, 3))).toEqual([1, 1, 2, 2, 3])
  })
})
