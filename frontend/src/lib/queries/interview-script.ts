import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getInterviewScript,
  updateInterviewScript,
} from '@/generated/interview-script/interview-script'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { InterviewScript, Role } from '@/lib/api/types'
import { queryKeys } from './keys'

export function useInterviewScript(
  cycleId: string,
  role: Role,
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.interviewScript.detail(cycleId, role),
    queryFn: () =>
      getInterviewScript(cycleId, { role }, opts) as Promise<InterviewScript>,
    enabled: !!cycleId,
  })
}

export function useUpdateInterviewScript() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      cycleId: string
      role: Role
      body: Parameters<typeof updateInterviewScript>[1]
      opts?: RequestOptions
    }) =>
      updateInterviewScript(
        vars.cycleId,
        vars.body,
        { role: vars.role },
        vars.opts
      ),
    onSuccess: (data, vars) => {
      queryClient.setQueryData(
        queryKeys.interviewScript.detail(vars.cycleId, vars.role),
        data
      )
    },
  })
}
