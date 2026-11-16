import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SaveIndicator } from './save-indicator'

describe('SaveIndicator', () => {
  it('holds its space before anything is saved, so nothing shifts', () => {
    const idle = renderToStaticMarkup(<SaveIndicator status="idle" />)
    const saved = renderToStaticMarkup(<SaveIndicator status="saved" />)
    expect(idle).toContain('role="status"')
    expect(idle).not.toContain('Sav')
    const width = (html: string) => html.match(/w-\d+/)?.[0]
    expect(width(idle)).toBeDefined()
    expect(width(idle)).toBe(width(saved))
  })

  it('announces each state with its own colour', () => {
    const saving = renderToStaticMarkup(<SaveIndicator status="saving" />)
    expect(saving).toContain('Saving…')
    expect(saving).toContain('role="status"')

    const saved = renderToStaticMarkup(<SaveIndicator status="saved" />)
    expect(saved).toContain('>Saved<')
    expect(saved).toContain('text-status-open')

    const error = renderToStaticMarkup(<SaveIndicator status="error" />)
    expect(error).toContain('Couldn’t save')
    expect(error).toContain('text-destructive')
  })
})
