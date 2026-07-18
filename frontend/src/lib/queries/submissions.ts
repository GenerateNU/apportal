import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listCodeSubmissions,
  upsertCodeSubmission,
} from '@/generated/code-submissions/code-submissions'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { CodeSubmission } from '@/lib/api/types'
import { queryKeys } from './keys'

// The backend exposes code submissions as a list per application (one per
// challenge); this resolves the first, preserving the single-submission shape
// the app used before.
export function useSubmission(applicationId: string, opts?: RequestOptions) {
  return useQuery({
    queryKey: queryKeys.submissions.detail(applicationId),
    queryFn: async () =>
      (((await listCodeSubmissions(applicationId, opts)) ?? [])[0] ??
        null) as CodeSubmission | null,
    enabled: !!applicationId,
  })
}

export function usePutSubmission() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      applicationId: string
      body: Parameters<typeof upsertCodeSubmission>[1]
      opts?: RequestOptions
    }) => upsertCodeSubmission(vars.applicationId, vars.body, vars.opts),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.submissions.detail(vars.applicationId),
      })
    },
  })
}
