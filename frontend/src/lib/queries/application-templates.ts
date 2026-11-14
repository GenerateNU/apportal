import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  getApplicationTemplate,
  listOpenApplicationTemplates,
  updateApplicationTemplate,
} from '@/generated/application-templates/application-templates'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { ApplicationTemplate } from '@/lib/api/types'
import { queryKeys } from './keys'

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

// Fetches the template for each (cycle, role) pair, e.g. to show each role's
// real application title on the admin applications board.
export function useApplicationTemplatesByCycleRoles(
  pairs: { cycleId: string; roleId: string }[],
  opts?: RequestOptions
) {
  return useQueries({
    queries: pairs.map(({ cycleId, roleId }) => ({
      queryKey: queryKeys.applicationTemplates.detail(cycleId, roleId),
      queryFn: () =>
        getApplicationTemplate(
          cycleId,
          { role_id: roleId },
          opts
        ) as Promise<ApplicationTemplate>,
      enabled: !!cycleId && !!roleId,
    })),
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
    },
  })
}
