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
  it('links to the applicant’s interview conduct page', () => {
    const html = render(
      <InterviewRow
        applicationId="app-1"
        name="Dao Ho"
        email="ho.dao@northeastern.edu"
        stage="interview"
        scheduledAt="2026-08-20T15:00:00Z"
        state="none"
      />
    )
    expect(html).toContain('href="/reviewer/my-interviews/app-1"')
    // The whole row links out; only the nested icon copies the email.
    expect(html).toContain('title="Copy ho.dao@northeastern.edu"')
  })

  it('omits the copy button when the applicant has no email on file', () => {
    const html = render(
      <InterviewRow applicationId="app-2" name="No Email" state="submitted" />
    )
    expect(html).toContain('href="/reviewer/my-interviews/app-2"')
    expect(html).not.toContain('<button')
    expect(html).toContain('Interviewed')
  })
})
