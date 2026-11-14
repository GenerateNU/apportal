import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createInterviewGroups,
  deleteInterviewGroup,
  listInterviewGroups,
  updateInterviewGroup,
} from '@/generated/interview-groups/interview-groups'
import type { GroupBody, InterviewGroupDetail } from '@/generated/model'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import { queryKeys } from './keys'

export function useInterviewGroups(cycleId: string, opts?: RequestOptions) {
  return useQuery({
    queryKey: queryKeys.interviewGroups.list(cycleId),
    queryFn: async () =>
      ((await listInterviewGroups(cycleId, opts)) ??
        []) as InterviewGroupDetail[],
    enabled: !!cycleId,
  })
}

function useInvalidateGroups() {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.interviewGroups.all })
}

export function useCreateInterviewGroups() {
  const invalidate = useInvalidateGroups()
  return useMutation({
    mutationFn: (vars: { cycleId: string; groups: GroupBody[] }) =>
      createInterviewGroups(vars.cycleId, { groups: vars.groups }),
    onSettled: invalidate,
  })
}

export function useUpdateInterviewGroup() {
  const invalidate = useInvalidateGroups()
  return useMutation({
    mutationFn: (vars: { id: string; body: GroupBody }) =>
      updateInterviewGroup(vars.id, vars.body),
    onSettled: invalidate,
  })
}

export function useDeleteInterviewGroup() {
  const invalidate = useInvalidateGroups()
  return useMutation({
    mutationFn: (id: string) => deleteInterviewGroup(id),
    onSettled: invalidate,
  })
}
