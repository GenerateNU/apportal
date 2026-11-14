import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createBranch,
  listBranches,
  updateBranch,
} from '@/generated/branches/branches'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { Branch } from '@/lib/api/types'
import { queryKeys } from './keys'

export async function fetchBranches(opts?: RequestOptions) {
  return ((await listBranches(opts)) ?? []) as Branch[]
}

export function useBranches(opts?: RequestOptions) {
  return useQuery({
    queryKey: queryKeys.branches.list(),
    queryFn: () => fetchBranches(opts),
  })
}

export function useCreateBranch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      body: Parameters<typeof createBranch>[0]
      opts?: RequestOptions
    }) => createBranch(vars.body, vars.opts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.branches.list() })
    },
  })
}

export function useUpdateBranch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      id: string
      body: Parameters<typeof updateBranch>[1]
      opts?: RequestOptions
    }) => updateBranch(vars.id, vars.body, vars.opts),
    onSuccess: (data, vars) => {
      queryClient.setQueryData(queryKeys.branches.detail(vars.id), data)
      queryClient.invalidateQueries({ queryKey: queryKeys.branches.list() })
    },
  })
}
