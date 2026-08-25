import { describe, expect, it } from 'vitest'
import { parseStoredFilters } from './usePersistedFilters'

type Filters = { role: string; stage: string }

describe('parseStoredFilters', () => {
  it('returns the stored snapshot', () => {
    expect(
      parseStoredFilters<Filters>('{"role":"software_engineer","stage":"all"}')
    ).toEqual({ role: 'software_engineer', stage: 'all' })
  })

  it('falls back to defaults when nothing is stored', () => {
    expect(parseStoredFilters<Filters>(null)).toEqual({})
    expect(parseStoredFilters<Filters>('')).toEqual({})
  })

  // A hand-edited or half-written entry must not take the page down with it.
  it('falls back to defaults on malformed JSON', () => {
    expect(parseStoredFilters<Filters>('{"role":')).toEqual({})
  })

  // The caller spreads the result over its own state, so anything that isn't
  // a plain object has to be rejected outright.
  it('rejects non-object JSON', () => {
    expect(parseStoredFilters<Filters>('null')).toEqual({})
    expect(parseStoredFilters<Filters>('"software_engineer"')).toEqual({})
    expect(parseStoredFilters<Filters>('[1,2,3]')).toEqual({})
  })
})
