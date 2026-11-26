import { describe, expect, it } from 'vitest'
import { isSplit } from './chief-votes'

describe('isSplit', () => {
  it('flags votes two or more steps apart', () => {
    expect(isSplit(['interview', 'no_interview'])).toBe(true)
    expect(isSplit(['strong_interview', 'no_interview'])).toBe(true)
    expect(
      isSplit(['strong_interview', 'interview', 'strong_no_interview'])
    ).toBe(true)
  })

  it('ignores neighbouring votes', () => {
    expect(isSplit(['strong_interview', 'interview'])).toBe(false)
    expect(isSplit(['no_interview', 'strong_no_interview'])).toBe(false)
  })

  it('never counts neutral as a split', () => {
    expect(isSplit(['strong_interview', 'neutral'])).toBe(false)
    expect(isSplit(['neutral', 'strong_no_interview'])).toBe(false)
  })

  it('needs at least two votes', () => {
    expect(isSplit(['strong_interview'])).toBe(false)
    expect(isSplit([undefined, 'interview'])).toBe(false)
    expect(isSplit([])).toBe(false)
  })
})
