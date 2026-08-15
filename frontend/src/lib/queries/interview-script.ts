import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getInterviewScript,
  updateInterviewScript,
} from '@/generated/interview-script/interview-script'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { InterviewScript } from '@/lib/api/types'
import { queryKeys } from './keys'

export function useInterviewScript(opts?: RequestOptions) {
  return useQuery({
    queryKey: queryKeys.interviewScript.all,
    queryFn: () => getInterviewScript(opts) as Promise<InterviewScript>,
  })
}

export function useUpdateInterviewScript() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      body: Parameters<typeof updateInterviewScript>[0]
      opts?: RequestOptions
    }) => updateInterviewScript(vars.body, vars.opts),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.interviewScript.all, data)
    },
  })
}
