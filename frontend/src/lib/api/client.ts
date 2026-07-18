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
