import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getApplicationTemplate,
  listCycleApplicationTemplates,
  listOpenApplicationTemplates,
  updateApplicationTemplate,
} from '@/generated/application-templates/application-templates'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { ApplicationTemplate } from '@/lib/api/types'
import { queryKeys } from './keys'

// Every role's template for one cycle in one request; the backend creates any
// missing drafts. Each is written back to its per-role cache entry.
export function useCycleApplicationTemplates(
  cycleId: string,
  opts?: RequestOptions
) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: queryKeys.applicationTemplates.cycleList(cycleId),
    queryFn: async () => {
      const templates = ((await listCycleApplicationTemplates(cycleId, opts)) ??
        []) as ApplicationTemplate[]
      for (const t of templates) {
        queryClient.setQueryData(
          queryKeys.applicationTemplates.detail(t.cycle_id, t.role_id),
          t
        )
      }
      return templates
    },
    enabled: !!cycleId,
  })
}

// Templates currently visible to applicants: the "cycle open AND template
// open" join happens server-side (list-open-application-templates), not here.
export function useOpenApplicationTemplates(opts?: RequestOptions) {
  return useQuery({
    queryKey: queryKeys.applicationTemplates.openList(),
    queryFn: async () =>
      ((await listOpenApplicationTemplates(opts)) ??
        []) as ApplicationTemplate[],
  })
}

export function useApplicationTemplate(
  cycleId: string,
  roleId: string,
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.applicationTemplates.detail(cycleId, roleId),
    queryFn: () =>
      getApplicationTemplate(
        cycleId,
        { role_id: roleId },
        opts
      ) as Promise<ApplicationTemplate>,
    enabled: !!cycleId && !!roleId,
  })
}

export function useUpdateApplicationTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      cycleId: string
      roleId: string
      body: Parameters<typeof updateApplicationTemplate>[1]
      opts?: RequestOptions
    }) =>
      updateApplicationTemplate(
        vars.cycleId,
        vars.body,
        { role_id: vars.roleId },
        vars.opts
      ),
    onSuccess: (data, vars) => {
      queryClient.setQueryData(
        queryKeys.applicationTemplates.detail(vars.cycleId, vars.roleId),
        data
      )
      queryClient.invalidateQueries({
        queryKey: queryKeys.applicationTemplates.cycleList(vars.cycleId),
      })
    },
  })
}
