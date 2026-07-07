import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { getApplicant, upsertApplicant } from '@/lib/api/applicants'
import type { FetchOptions } from '@/lib/api/client'
import { queryKeys } from './keys'

export function useApplicant(nuid: string, opts?: FetchOptions) {
  return useQuery({
    queryKey: queryKeys.applicants.detail(nuid),
    queryFn: () => getApplicant(nuid, opts),
    enabled: !!nuid,
  })
}

// Fetches a batch of applicants by nuid, e.g. to hydrate rows derived from
// an applications list. Each nuid gets its own cache entry, shared with
// useApplicant.
export function useApplicantsByNuids(nuids: string[], opts?: FetchOptions) {
  return useQueries({
    queries: nuids.map((nuid) => ({
      queryKey: queryKeys.applicants.detail(nuid),
      queryFn: () => getApplicant(nuid, opts),
    })),
  })
}

export function useUpsertApplicant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      body: Parameters<typeof upsertApplicant>[0]
      opts?: FetchOptions
    }) => upsertApplicant(vars.body, vars.opts),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.applicants.detail(data.nuid), data)
    },
  })
}
