import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createApplication,
  getApplication,
  getApplications,
  updateApplication,
} from '@/lib/api/applications'
import type { FetchOptions } from '@/lib/api/client'
import type { ApplicationStage, Role } from '@/lib/api/types'
import { queryKeys } from './keys'

export function useApplications(
  params?: { cycle_id?: string; stage?: ApplicationStage; role?: Role },
  opts?: FetchOptions
) {
  return useQuery({
    queryKey: queryKeys.applications.list(params),
    queryFn: () => getApplications(params, opts),
  })
}

export function useApplication(id: string, opts?: FetchOptions) {
  return useQuery({
    queryKey: queryKeys.applications.detail(id),
    queryFn: () => getApplication(id, opts),
    enabled: !!id,
  })
}

export function useCreateApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      body: Parameters<typeof createApplication>[0]
      opts?: FetchOptions
    }) => createApplication(vars.body, vars.opts),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.lists(),
      })
    },
  })
}

export function useUpdateApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      id: string
      body: Parameters<typeof updateApplication>[1]
      opts?: FetchOptions
    }) => updateApplication(vars.id, vars.body, vars.opts),
    onSuccess: (data, vars) => {
      queryClient.setQueryData(queryKeys.applications.detail(vars.id), data)
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.lists(),
      })
    },
  })
}
