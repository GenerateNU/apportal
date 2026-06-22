const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

export class APIError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = 'APIError'
  }
}

export type FetchOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
  // Reviewer auth headers — omit when calling unauthenticated endpoints
  actor?: { nuid: string; role: 'tl' | 'chief' }
  next?: NextFetchRequestConfig
}

export async function apiFetch<T>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { body, actor, next, headers: extraHeaders, ...rest } = options

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  }

  if (actor) {
    ;(headers as Record<string, string>)['X-NUID'] = actor.nuid
    ;(headers as Record<string, string>)['X-Role'] = actor.role
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    // Pass Next.js cache config through when called from server components
    ...(next ? { next } : {}),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new APIError(res.status, text)
  }

  // 204 No Content
  if (res.status === 204) return undefined as T

  return res.json() as Promise<T>
}
