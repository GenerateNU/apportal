import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ToastProvider } from '@/components/ui/toast'
import { InterviewRow } from './InterviewRow'

// Static markup only — there's no DOM environment here, so this covers the
// structure (which element the row is, and what it offers) rather than the
// click itself.
function render(node: ReactNode) {
  return renderToStaticMarkup(<ToastProvider>{node}</ToastProvider>)
}

describe('InterviewRow', () => {
  it('is a button that copies the interviewee’s email', () => {
    const html = render(
      <InterviewRow
        name="Dao Ho"
        email="ho.dao@northeastern.edu"
        stage="interview"
        scheduledAt="2026-08-20T15:00:00Z"
        state="none"
      />
    )
    expect(html).toContain(
      '<button type="button" title="Copy ho.dao@northeastern.edu"'
    )
    // Copying is the row's only action; it never links anywhere.
    expect(html).not.toContain('<a ')
  })

  it('stays inert when the applicant has no email on file', () => {
    const html = render(<InterviewRow name="No Email" state="submitted" />)
    expect(html).not.toContain('<button')
    expect(html).toContain('Interviewed')
  })
})
