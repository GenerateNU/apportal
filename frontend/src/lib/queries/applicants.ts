import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

// Deliberately no batch-by-nuid hook: listApplications already joins the
// applicant's full_name and email onto every row, so fanning out one request
// per nuid to hydrate a list is a round trip per applicant for data the list
// response already carried. Read app.full_name instead.

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
