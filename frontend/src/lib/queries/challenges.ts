import { useQuery } from '@tanstack/react-query'
import { listCycleChallenges } from '@/generated/code-challenges/code-challenges'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { CodeChallenge } from '@/lib/api/types'
import { queryKeys } from './keys'

export function useChallenges(
  cycleId: string,
  roleId?: string,
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.challenges.list(cycleId, roleId),
    queryFn: async () =>
      ((await listCycleChallenges(cycleId, { role_id: roleId }, opts)) ??
        []) as CodeChallenge[],
    enabled: !!cycleId,
  })
}
