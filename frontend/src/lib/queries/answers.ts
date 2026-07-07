import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAnswers, putAnswers } from '@/lib/api/answers'
import type { FetchOptions } from '@/lib/api/client'
import { queryKeys } from './keys'

export function useAnswers(applicationId: string, opts?: FetchOptions) {
  return useQuery({
    queryKey: queryKeys.answers.list(applicationId),
    queryFn: () => getAnswers(applicationId, opts),
    enabled: !!applicationId,
  })
}

export function usePutAnswers() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      applicationId: string
      body: Parameters<typeof putAnswers>[1]
      opts?: FetchOptions
    }) => putAnswers(vars.applicationId, vars.body, vars.opts),
    onSuccess: (data, vars) => {
      queryClient.setQueryData(queryKeys.answers.list(vars.applicationId), data)
    },
  })
}
