import Axios, { type AxiosError, type AxiosRequestConfig } from 'axios'
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

// Extra per-request options accepted by the generated hooks (via
// SecondParameter). `actor` sets the reviewer auth headers for this one request
// (required server-side; optional client-side once setActorHeaders has run);
// standard AxiosRequestConfig fields pass through.
export type RequestOptions = AxiosRequestConfig & {
  actor?: Actor
}

// customInstance is the mutator Orval routes every generated request through.
// It unwraps the axios response to the typed body and maps non-2xx responses to
// APIError, matching the hand-written apiClient's contract.
export const customInstance = <T>(
  config: AxiosRequestConfig,
  options?: RequestOptions
): Promise<T> => {
  const { actor, headers, ...rest } = options ?? {}

  return AXIOS_INSTANCE({
    ...config,
    ...rest,
    headers: {
      ...config.headers,
      ...headers,
      ...(actor ? { 'X-NUID': actor.nuid, 'X-Role': actor.role } : {}),
    },
  })
    .then(({ data }) => data as T)
    .catch((error: AxiosError) => {
      if (error.response) {
        const body = error.response.data
        const message =
          typeof body === 'string' ? body : JSON.stringify(body ?? '')
        throw new APIError(error.response.status, message)
      }
      throw error
    })
}

export default customInstance
