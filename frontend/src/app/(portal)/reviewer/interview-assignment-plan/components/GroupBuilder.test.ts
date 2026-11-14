import { describe, expect, it } from 'vitest'
import { formGroups, nextGroupNames } from './GroupBuilder'

describe('formGroups', () => {
  it('splits evenly', () => {
    expect(formGroups(['a', 'b', 'c', 'd'], 2)).toEqual([
      ['a', 'c'],
      ['b', 'd'],
    ])
  })

  it('spreads leftovers instead of leaving a short group', () => {
    const groups = formGroups(['a', 'b', 'c', 'd', 'e', 'f', 'g'], 2)
    expect(groups.map((g) => g.length)).toEqual([3, 2, 2])
  })

  it('makes one group when there are fewer leads than the size', () => {
    expect(formGroups(['a'], 3)).toEqual([['a']])
  })

  it('returns nothing for no leads', () => {
    expect(formGroups([], 2)).toEqual([])
  })
})

describe('nextGroupNames', () => {
  it('skips names already taken', () => {
    expect(nextGroupNames(['Group 1', 'Group 3'], 3)).toEqual([
      'Group 2',
      'Group 4',
      'Group 5',
    ])
  })
})
