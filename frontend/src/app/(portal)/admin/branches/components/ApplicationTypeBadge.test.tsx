import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  ApplicationTypeBadge,
  applicationTypeLabel,
} from './ApplicationTypeBadge'

describe('applicationTypeLabel', () => {
  it('labels each type', () => {
    expect(applicationTypeLabel('member')).toBe('Member cycle')
    expect(applicationTypeLabel('lead')).toBe('Lead cycle')
    expect(applicationTypeLabel('chief')).toBe('Chief cycle')
  })

  it('falls back to the raw value for an unknown type', () => {
    expect(applicationTypeLabel('alumni')).toBe('alumni cycle')
  })
})

describe('ApplicationTypeBadge', () => {
  it('is the same black outline for every type', () => {
    for (const type of ['member', 'lead', 'chief']) {
      const html = renderToStaticMarkup(<ApplicationTypeBadge type={type} />)
      expect(html).toContain('border-ink')
      expect(html).toContain('bg-white')
      expect(html).not.toMatch(/gen-/)
    }
  })
})
