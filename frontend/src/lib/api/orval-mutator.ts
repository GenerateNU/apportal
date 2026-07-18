import Axios from 'axios'
import { APIError } from './client'

export const AXIOS_INSTANCE = Axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080',
})

// The reviewer identity the backend reads from the X-NUID / X-Role headers.
export type Actor = { nuid: string; role: string }

// setActorHeaders records the signed-in reviewer as default headers on the
// shared axios instance, so client-side generated requests are authed without
// passing `actor` on every call. Call it from a client component/effect when the
// signed-in user changes (and clearActorHeaders on sign-out).
//
// CLIENT-ONLY: the axios instance is shared across every request on the server,
// so a default set there would leak one user's identity to another. Server-side
// prefetch must instead pass `actor` per request via RequestOptions below — a
// per-request actor always overrides these defaults.
export function setActorHeaders(actor: Actor) {
  AXIOS_INSTANCE.defaults.headers.common['X-NUID'] = actor.nuid
  AXIOS_INSTANCE.defaults.headers.common['X-Role'] = actor.role
}

// clearActorHeaders removes the default reviewer headers (e.g. on sign-out).
export function clearActorHeaders() {
  delete AXIOS_INSTANCE.defaults.headers.common['X-NUID']
  delete AXIOS_INSTANCE.defaults.headers.common['X-Role']
}

// The request shape Orval passes to the mutator. It's typed structurally rather
// than with axios's `AxiosRequestConfig`, because axios ships its named types
// only through a CJS `.d.cts` that this project's bundler module resolution
// won't surface as named imports (only the default `Axios` value resolves).
type RequestConfig = {
  url?: string
  method?: string
  params?: unknown
  data?: unknown
  headers?: Record<string, string | undefined>
  signal?: AbortSignal
  responseType?: string
}

// Extra per-request options accepted by the generated hooks (via
// SecondParameter). `actor` sets the reviewer auth headers for this one request
// (required server-side; optional client-side once setActorHeaders has run);
// standard request-config fields pass through.
export type RequestOptions = RequestConfig & {
  actor?: Actor
}

// customInstance is the mutator Orval routes every generated request through.
// It unwraps the axios response to the typed body and maps non-2xx responses to
// APIError, matching the hand-written apiClient's contract.
export const customInstance = async <T>(
  config: RequestConfig,
  options?: RequestOptions
): Promise<T> => {
  const { actor, headers, ...rest } = options ?? {}

  const merged = {
    ...config,
    ...rest,
    headers: {
      ...config.headers,
      ...headers,
      ...(actor ? { 'X-NUID': actor.nuid, 'X-Role': actor.role } : {}),
    },
  }

  try {
    const response = await AXIOS_INSTANCE.request(
      merged as Parameters<typeof AXIOS_INSTANCE.request>[0]
    )
    return (response as { data: T }).data
  } catch (error) {
    // Duck-type the axios error rather than import its (unreliably exported)
    // types: an HTTP error carries `isAxiosError` and a `response`; a network
    // failure has no `response`, so it rethrows as-is.
    const axiosError = error as {
      isAxiosError?: boolean
      response?: { status: number; data: unknown }
    }
    if (axiosError.isAxiosError && axiosError.response) {
      const body = axiosError.response.data
      const message =
        typeof body === 'string' ? body : JSON.stringify(body ?? '')
      throw new APIError(axiosError.response.status, message)
    }
    throw error
  }
}

export default customInstance
