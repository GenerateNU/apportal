import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createChallenge, getChallenges } from '@/lib/api/challenges'
import type { FetchOptions } from '@/lib/api/client'
import type { Role } from '@/lib/api/types'
import { queryKeys } from './keys'

export function useChallenges(
  cycleId: string,
  role?: Role,
  opts?: FetchOptions
) {
  return useQuery({
    queryKey: queryKeys.challenges.list(cycleId, role),
    queryFn: () => getChallenges(cycleId, role, opts),
    enabled: !!cycleId,
  })
}

export function useCreateChallenge() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      cycleId: string
      body: Parameters<typeof createChallenge>[1]
      opts?: FetchOptions
    }) => createChallenge(vars.cycleId, vars.body, vars.opts),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.challenges.lists(),
      })
    },
  })
}
