import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  getApplicant,
  upsertApplicant,
} from '@/generated/applicants/applicants'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { Applicant } from '@/lib/api/types'
import { queryKeys } from './keys'

export function useApplicant(nuid: string, opts?: RequestOptions) {
  return useQuery({
    queryKey: queryKeys.applicants.detail(nuid),
    queryFn: () => getApplicant(nuid, opts) as Promise<Applicant>,
    enabled: !!nuid,
  })
}

// Fetches a batch of applicants by nuid, e.g. to hydrate rows derived from
// an applications list. Each nuid gets its own cache entry, shared with
// useApplicant.
export function useApplicantsByNuids(nuids: string[], opts?: RequestOptions) {
  return useQueries({
    queries: nuids.map((nuid) => ({
      queryKey: queryKeys.applicants.detail(nuid),
      queryFn: () => getApplicant(nuid, opts) as Promise<Applicant>,
    })),
  })
}

export function useUpsertApplicant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      body: Parameters<typeof upsertApplicant>[0]
      opts?: RequestOptions
    }) => upsertApplicant(vars.body, vars.opts),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.applicants.detail(data.nuid), data)
    },
  })
}
