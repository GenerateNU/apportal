// Error thrown by the generated API client (see orval-mutator.ts) for any
// non-2xx response, carrying the HTTP status alongside the message.
export class APIError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = 'APIError'
  }
}

export function apiErrorDetail(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  try {
    const body = JSON.parse(message) as {
      detail?: string
      errors?: { message?: string; location?: string }[]
    }
    const errors = (body.errors ?? [])
      .map((e) => [e.location, e.message].filter(Boolean).join(': '))
      .filter(Boolean)
    if (
      body.detail &&
      errors.length > 0 &&
      body.detail === 'validation failed'
    ) {
      return errors.join('; ')
    }
    return body.detail ?? message
  } catch {
    return message
  }
}
