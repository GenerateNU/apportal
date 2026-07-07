import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSubmission, putSubmission } from '@/lib/api/submissions'
import type { FetchOptions } from '@/lib/api/client'
import { queryKeys } from './keys'

export function useSubmission(applicationId: string, opts?: FetchOptions) {
  return useQuery({
    queryKey: queryKeys.submissions.detail(applicationId),
    queryFn: () => getSubmission(applicationId, opts),
    enabled: !!applicationId,
  })
}

export function usePutSubmission() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      applicationId: string
      body: Parameters<typeof putSubmission>[1]
      opts?: FetchOptions
    }) => putSubmission(vars.applicationId, vars.body, vars.opts),
    onSuccess: (data, vars) => {
      queryClient.setQueryData(
        queryKeys.submissions.detail(vars.applicationId),
        data
      )
    },
  })
}
