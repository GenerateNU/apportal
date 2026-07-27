import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { listAnswers, upsertAnswers } from '@/generated/answers/answers'
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

// Fetches a batch of applications' answers, e.g. to preview responses inline
// on an applications list. Each application id gets its own cache entry,
// shared with useAnswers.
export function useAnswersByApplicationIds(
  applicationIds: string[],
  opts?: RequestOptions
) {
  return useQueries({
    queries: applicationIds.map((applicationId) => ({
      queryKey: queryKeys.answers.list(applicationId),
      queryFn: async () =>
        ((await listAnswers(applicationId, opts)) ?? []) as WrittenAnswer[],
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
