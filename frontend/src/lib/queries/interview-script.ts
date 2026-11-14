import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getInterviewScript,
  updateInterviewScript,
} from '@/generated/interview-script/interview-script'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { InterviewScript } from '@/lib/api/types'
import { queryKeys } from './keys'

export function useInterviewScript(
  cycleId: string,
  roleId: string,
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.interviewScript.detail(cycleId, roleId),
    queryFn: () =>
      getInterviewScript(
        cycleId,
        { role_id: roleId },
        opts
      ) as Promise<InterviewScript>,
    enabled: !!cycleId && !!roleId,
  })
}

export function useUpdateInterviewScript() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      cycleId: string
      roleId: string
      body: Parameters<typeof updateInterviewScript>[1]
      opts?: RequestOptions
    }) =>
      updateInterviewScript(
        vars.cycleId,
        vars.body,
        { role_id: vars.roleId },
        vars.opts
      ),
    onSuccess: (data, vars) => {
      queryClient.setQueryData(
        queryKeys.interviewScript.detail(vars.cycleId, vars.roleId),
        data
      )
    },
  })
}
