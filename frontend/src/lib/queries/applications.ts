import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createApplication,
  deleteApplication,
  getApplication,
  listApplications,
  updateApplication,
} from '@/generated/applications/applications'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { Application, ApplicationStage, Role } from '@/lib/api/types'
import { queryKeys } from './keys'

export function useApplications(
  params?: {
    cycle_id?: string
    user_nuid?: string
    assigned_to?: string
    stage?: ApplicationStage
    role?: Role
  },
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.applications.list(params),
    queryFn: async () =>
      ((await listApplications(params, opts)) ?? []) as Application[],
  })
}

export function useApplication(id: string, opts?: RequestOptions) {
  return useQuery({
    queryKey: queryKeys.applications.detail(id),
    queryFn: () => getApplication(id, opts) as Promise<Application>,
    enabled: !!id,
  })
}

export function useCreateApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      body: Parameters<typeof createApplication>[0]
      opts?: RequestOptions
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
      opts?: RequestOptions
    }) => updateApplication(vars.id, vars.body, vars.opts),
    onSuccess: (data, vars) => {
      queryClient.setQueryData(queryKeys.applications.detail(vars.id), data)
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.lists(),
      })
    },
  })
}

// Discards an applicant's own in-progress draft (owner + draft-only,
// enforced server-side) so they can start over against a fresh form.
export function useDeleteApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; opts?: RequestOptions }) =>
      deleteApplication(vars.id, vars.opts),
    onSuccess: (_data, vars) => {
      queryClient.removeQueries({
        queryKey: queryKeys.applications.detail(vars.id),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.lists(),
      })
    },
  })
}
