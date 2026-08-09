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

// Pinned cycle every table/list defaults to for now. Swap this out (or make
// it a real per-org setting) once Fall 2026 is no longer the cycle everyone
// cares about by default.
//TODO: This is a temporary hack to make the default cycle be the pinned cycle. Once we have a better way to determine the default cycle, we can remove this.
export const DEFAULT_CYCLE_ID = '94dde9fe-a069-4178-90db-282b611e2904'

// Picks which cycle a page should default to when no cycle has been chosen
// yet: the pinned default if it's in the list, otherwise the open cycle,
// otherwise the first one.
export function pickDefaultCycleId(cycles: Cycle[]): string | undefined {
  if (cycles.some((c) => c.id === DEFAULT_CYCLE_ID)) return DEFAULT_CYCLE_ID
  return (cycles.find((c) => c.status === 'open') ?? cycles[0])?.id
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
