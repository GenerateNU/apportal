import Axios from 'axios'
import { createClient } from '@/lib/supabase/client'
import { APIError } from './client'

export const AXIOS_INSTANCE = Axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080',
})

// Lazily constructed only in the browser, where customInstance below attaches
// the signed-in user's real Supabase access token to every request. Safe to
// look up per request here — unlike the shared AXIOS_INSTANCE above, which is
// a process-wide singleton on the server and so can't default to one user's
// identity, this only ever runs client-side, where there's exactly one
// signed-in user per tab. Server components instead pass an explicit
// Authorization header per request (see server-request-options.ts).
let browserSupabase: ReturnType<typeof createClient> | undefined
function getBrowserSupabase() {
  if (typeof window === 'undefined') return undefined
  browserSupabase ??= createClient()
  return browserSupabase
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
// SecondParameter). Currently just request-config passthrough (e.g. server
// components set `headers.Authorization` explicitly — see
// server-request-options.ts); kept as a named type since query hooks
// throughout the app are typed against it.
export type RequestOptions = RequestConfig

// customInstance is the mutator Orval routes every generated request through.
// It unwraps the axios response to the typed body and maps non-2xx responses to
// APIError, matching the hand-written apiClient's contract.
export const customInstance = async <T>(
  config: RequestConfig,
  options?: RequestOptions
): Promise<T> => {
  const headers: Record<string, string | undefined> = {
    ...config.headers,
    ...options?.headers,
  }

  const supabase = getBrowserSupabase()
  if (supabase && !headers.Authorization) {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`
    }
  }

  const merged = { ...config, ...options, headers }

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
