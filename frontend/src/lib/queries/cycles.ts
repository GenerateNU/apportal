import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCycle,
  getCycle,
  listCycles,
  updateCycle,
} from '@/generated/cycles/cycles'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { Cycle } from '@/lib/api/types'
import { queryKeys } from './keys'

export function useCycles(opts?: RequestOptions) {
  return useQuery({
    queryKey: queryKeys.cycles.lists(),
    queryFn: async () => ((await listCycles(opts)) ?? []) as Cycle[],
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
