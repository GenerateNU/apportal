import Axios, { type AxiosError, type AxiosRequestConfig } from 'axios'
import { APIError } from './client'

export const AXIOS_INSTANCE = Axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080',
})

// Extra per-request options accepted by the generated hooks (via
// SecondParameter). `actor` sets the reviewer auth headers the backend reads;
// standard AxiosRequestConfig fields pass through.
export type RequestOptions = AxiosRequestConfig & {
  actor?: { nuid: string; role: string }
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
