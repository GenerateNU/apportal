import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  listAnswers,
  listAnswersBulk,
  upsertAnswers,
} from '@/generated/answers/answers'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { WrittenAnswer } from '@/lib/api/types'
import { queryKeys } from './keys'

export function useAnswers(applicationId: string, opts?: RequestOptions) {
  return useQuery({
    queryKey: queryKeys.answers.list(applicationId),
    queryFn: async () =>
      ((await listAnswers(applicationId, opts)) ?? []) as WrittenAnswer[],
    enabled: !!applicationId,
  })
}

// Fetches answers for several batches of applications — one request per
// batch, not one per application. Callers pass their applications grouped the
// way they loaded them (a page at a time), so each batch keeps its own cache
// entry and loading more never refetches the ones already in hand.
//
// Each response is also written back to the per-application entries that
// useAnswers reads, so opening a single application afterwards is a cache hit
// rather than a fresh request.
export function useAnswersByApplicationIdBatches(
  applicationIdBatches: string[][],
  opts?: RequestOptions
) {
  const queryClient = useQueryClient()
  return useQueries({
    queries: applicationIdBatches.map((applicationIds) => ({
      queryKey: queryKeys.answers.bulk(applicationIds),
      queryFn: async () => {
        const answers = ((await listAnswersBulk(
          { application_ids: applicationIds.join(',') },
          opts
        )) ?? []) as WrittenAnswer[]

        // Start every requested id at an empty list: an application with no
        // answers still needs an entry, or its row can't tell "none" from
        // "not loaded".
        const byApplicationId: Record<string, WrittenAnswer[]> = {}
        for (const id of applicationIds) byApplicationId[id] = []
        for (const answer of answers) {
          byApplicationId[answer.application_id]?.push(answer)
        }
        for (const [id, list] of Object.entries(byApplicationId)) {
          queryClient.setQueryData(queryKeys.answers.list(id), list)
        }
        return byApplicationId
      },
      enabled: applicationIds.length > 0,
    })),
  })
}

export function usePutAnswers() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      applicationId: string
      body: Parameters<typeof upsertAnswers>[1]
      opts?: RequestOptions
    }) => upsertAnswers(vars.applicationId, vars.body, vars.opts),
    onSuccess: (data, vars) => {
      queryClient.setQueryData(queryKeys.answers.list(vars.applicationId), data)
    },
  })
}
