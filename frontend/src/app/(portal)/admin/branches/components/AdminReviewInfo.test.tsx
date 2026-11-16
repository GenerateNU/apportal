import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AdminReviewInfo } from './AdminReviewInfo'

describe('AdminReviewInfo', () => {
  it('says admins review the cycle and explains why on hover', () => {
    const html = renderToStaticMarkup(<AdminReviewInfo />)
    expect(html).toContain('Reviewed by admins')
    expect(html).toContain(
      'aria-label="Admins review chief applications, so this cycle has no leads or chiefs."'
    )
  })
})
