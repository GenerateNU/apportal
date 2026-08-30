import { describe, expect, it } from 'vitest'
import { roundOf } from './snake'

describe('roundOf', () => {
  it('counts a round per trip around the order', () => {
    expect([1, 3, 4, 6, 7].map((n) => roundOf(n, 3))).toEqual([1, 1, 2, 2, 3])
  })
})
