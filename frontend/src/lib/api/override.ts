export type OverrideRequest = {
  level: 'override' | 'destructive'
  reason: string
}

type Asker = (request: OverrideRequest) => Promise<boolean>

let asker: Asker | undefined

// Registered by OverrideConfirmProvider; without one (server, tests) nothing is confirmed.
export function setOverrideAsker(fn: Asker | undefined) {
  asker = fn
}

export function askToOverride(request: OverrideRequest): Promise<boolean> {
  return asker ? asker(request) : Promise.resolve(false)
}

// The workflow answers 409 with an error at query.confirm_override when a chief
// or admin may go ahead after confirming.
export function overrideRequest(
  status: number,
  body: unknown
): OverrideRequest | null {
  if (status !== 409 || typeof body !== 'object' || body === null) return null
  const errors = (body as { errors?: unknown }).errors
  if (!Array.isArray(errors)) return null
  const e = errors.find(
    (x) =>
      typeof x === 'object' &&
      x !== null &&
      (x as { location?: unknown }).location === 'query.confirm_override'
  ) as { message?: unknown; value?: unknown } | undefined
  if (!e) return null
  return {
    level: e.value === 'destructive' ? 'destructive' : 'override',
    reason: typeof e.message === 'string' ? e.message : '',
  }
}
