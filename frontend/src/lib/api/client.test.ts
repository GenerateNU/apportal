import { describe, expect, it } from 'vitest'
import { APIError, apiErrorDetail } from './client'

describe('apiErrorDetail', () => {
  it('pulls the detail out of a huma error body', () => {
    const err = new APIError(
      422,
      JSON.stringify({ status: 422, detail: 'not a lead or chief: Ada' })
    )
    expect(apiErrorDetail(err)).toBe('not a lead or chief: Ada')
  })

  it('lists field errors for a validation failure', () => {
    const err = new APIError(
      422,
      JSON.stringify({
        detail: 'validation failed',
        errors: [{ location: 'body.cap', message: 'expected number' }],
      })
    )
    expect(apiErrorDetail(err)).toBe('body.cap: expected number')
  })

  it('falls back to the raw message', () => {
    expect(apiErrorDetail(new Error('Network Error'))).toBe('Network Error')
  })
})
