import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getInterview,
  listInterviewsBulk,
} from '@/generated/interviews/interviews'
import { APIError } from '@/lib/api/client'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { Interview } from '@/lib/api/types'
import { queryKeys } from './keys'

// The backend 404s until the interviewer has saved a write-up — that's not an
// error here, just the "not started" state.
async function fetchInterview(applicationId: string, opts?: RequestOptions) {
  try {
    return (await getInterview(applicationId, opts)) as Interview
  } catch (err) {
    if (err instanceof APIError && err.status === 404) return undefined
    throw err
  }
}

export function useInterview(applicationId: string, opts?: RequestOptions) {
  return useQuery({
    queryKey: queryKeys.interviews.detail(applicationId),
    queryFn: () => fetchInterview(applicationId, opts),
    enabled: !!applicationId,
  })
}

// Fetches interviews for several batches of applications — one request per
// batch, not one per application. Each response is written back to the
// per-application entries useInterview reads, so opening one afterwards is a
// cache hit rather than a fresh request.
export function useInterviewsByApplicationIdBatches(
  applicationIdBatches: string[][],
  opts?: RequestOptions
) {
  const queryClient = useQueryClient()
  return useQueries({
    queries: applicationIdBatches.map((applicationIds) => ({
      queryKey: queryKeys.interviews.bulk(applicationIds),
      queryFn: async () => {
        const interviews = ((await listInterviewsBulk(
          { application_ids: applicationIds.join(',') },
          opts
        )) ?? []) as Interview[]

        const byApplicationId: Record<string, Interview | undefined> = {}
        // An application with no interview still needs an entry, or its row
        // can't tell "not started" from "not loaded".
        for (const id of applicationIds) byApplicationId[id] = undefined
        for (const interview of interviews) {
          byApplicationId[interview.application_id] = interview
        }
        for (const [id, interview] of Object.entries(byApplicationId)) {
          queryClient.setQueryData(queryKeys.interviews.detail(id), interview)
        }
        return byApplicationId
      },
      enabled: applicationIds.length > 0,
    })),
  })
}
