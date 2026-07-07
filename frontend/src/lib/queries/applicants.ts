import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
