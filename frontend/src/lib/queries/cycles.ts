import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createCycle, getCycle, getCycles, updateCycle } from '@/lib/api/cycles'
import type { FetchOptions } from '@/lib/api/client'
import { queryKeys } from './keys'

export function useCycles(opts?: FetchOptions) {
  return useQuery({
    queryKey: queryKeys.cycles.lists(),
    queryFn: () => getCycles(opts),
  })
}

export function useCycle(id: string, opts?: FetchOptions) {
  return useQuery({
    queryKey: queryKeys.cycles.detail(id),
    queryFn: () => getCycle(id, opts),
    enabled: !!id,
  })
}

export function useCreateCycle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      body: Parameters<typeof createCycle>[0]
      opts?: FetchOptions
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
      opts?: FetchOptions
    }) => updateCycle(vars.id, vars.body, vars.opts),
    onSuccess: (data, vars) => {
      queryClient.setQueryData(queryKeys.cycles.detail(vars.id), data)
      queryClient.invalidateQueries({ queryKey: queryKeys.cycles.lists() })
    },
  })
}
