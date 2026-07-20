import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  createCycle,
  cycleTemplateSummary,
  getCycle,
  listCycles,
  updateCycle,
} from '@/generated/cycles/cycles'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { Cycle, CycleRoleSummary, CycleStatus } from '@/lib/api/types'
import { queryKeys } from './keys'

export function useCycles(
  params?: { status?: CycleStatus },
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.cycles.list(params),
    queryFn: async () => ((await listCycles(params, opts)) ?? []) as Cycle[],
  })
}

// Per-role question/challenge/submission counts for a cycle, computed
// server-side (COUNT queries) so the caller never has to fetch full row sets
// just to count them.
export function useCycleTemplateSummary(
  cycleId: string,
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.cycles.templateSummary(cycleId),
    queryFn: async () =>
      ((await cycleTemplateSummary(cycleId, opts)) ?? []) as CycleRoleSummary[],
    enabled: !!cycleId,
  })
}

// Fetches the template summary for each cycle, e.g. to build a board of
// per-cycle × role template cards without pulling every question/challenge/
// application row across every cycle.
export function useCycleTemplateSummariesByCycles(
  cycleIds: string[],
  opts?: RequestOptions
) {
  return useQueries({
    queries: cycleIds.map((cycleId) => ({
      queryKey: queryKeys.cycles.templateSummary(cycleId),
      queryFn: async () =>
        ((await cycleTemplateSummary(cycleId, opts)) ??
          []) as CycleRoleSummary[],
      enabled: !!cycleId,
    })),
  })
}

export function useCycle(id: string, opts?: RequestOptions) {
  return useQuery({
    queryKey: queryKeys.cycles.detail(id),
    queryFn: () => getCycle(id, opts) as Promise<Cycle>,
    enabled: !!id,
  })
}

export function useCreateCycle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      body: Parameters<typeof createCycle>[0]
      opts?: RequestOptions
    }) => createCycle(vars.body, vars.opts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cycles.lists() })
    },
  })
}

export function useUpdateCycle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      id: string
      body: Parameters<typeof updateCycle>[1]
      opts?: RequestOptions
    }) => updateCycle(vars.id, vars.body, vars.opts),
    onSuccess: (data, vars) => {
      queryClient.setQueryData(queryKeys.cycles.detail(vars.id), data)
      queryClient.invalidateQueries({ queryKey: queryKeys.cycles.lists() })
    },
  })
}
