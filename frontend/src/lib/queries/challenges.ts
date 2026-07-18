import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  createChallenge,
  listCycleChallenges,
} from '@/generated/code-challenges/code-challenges'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { CodeChallenge, Role } from '@/lib/api/types'
import { queryKeys } from './keys'

export function useChallenges(
  cycleId: string,
  role?: Role,
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.challenges.list(cycleId, role),
    queryFn: async () =>
      ((await listCycleChallenges(cycleId, { role }, opts)) ??
        []) as CodeChallenge[],
    enabled: !!cycleId,
  })
}

// Fetches all challenges for each cycle, e.g. to build per-cycle template
// summaries. Each cycle gets its own cache entry, shared with useChallenges.
export function useChallengesByCycles(
  cycleIds: string[],
  opts?: RequestOptions
) {
  return useQueries({
    queries: cycleIds.map((cycleId) => ({
      queryKey: queryKeys.challenges.list(cycleId),
      queryFn: async () =>
        ((await listCycleChallenges(cycleId, undefined, opts)) ??
          []) as CodeChallenge[],
      enabled: !!cycleId,
    })),
  })
}

export function useCreateChallenge() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      cycleId: string
      body: Parameters<typeof createChallenge>[1]
      opts?: RequestOptions
    }) => createChallenge(vars.cycleId, vars.body, vars.opts),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.challenges.lists(),
      })
    },
  })
}
