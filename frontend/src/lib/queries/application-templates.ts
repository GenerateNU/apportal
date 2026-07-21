import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getApplicationTemplate,
  updateApplicationTemplate,
} from '@/generated/application-templates/application-templates'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { ApplicationTemplate, Role } from '@/lib/api/types'
import { ROLE_COLUMNS } from '@/lib/roles'
import { queryKeys } from './keys'

export function useApplicationTemplate(
  cycleId: string,
  role: Role,
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.applicationTemplates.detail(cycleId, role),
    queryFn: () =>
      getApplicationTemplate(
        cycleId,
        { role },
        opts
      ) as Promise<ApplicationTemplate>,
    enabled: !!cycleId,
  })
}

// Fetches every role's template for each cycle, e.g. to show each role's real
// application title on the admin applications board without a separate
// request per card render.
export function useApplicationTemplatesByCycles(
  cycleIds: string[],
  opts?: RequestOptions
) {
  return useQueries({
    queries: cycleIds.flatMap((cycleId) =>
      ROLE_COLUMNS.map((role) => ({
        queryKey: queryKeys.applicationTemplates.detail(cycleId, role),
        queryFn: () =>
          getApplicationTemplate(
            cycleId,
            { role },
            opts
          ) as Promise<ApplicationTemplate>,
        enabled: !!cycleId,
      }))
    ),
  })
}

export function useUpdateApplicationTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      cycleId: string
      role: Role
      body: Parameters<typeof updateApplicationTemplate>[1]
      opts?: RequestOptions
    }) =>
      updateApplicationTemplate(
        vars.cycleId,
        vars.body,
        { role: vars.role },
        vars.opts
      ),
    onSuccess: (data, vars) => {
      queryClient.setQueryData(
        queryKeys.applicationTemplates.detail(vars.cycleId, vars.role),
        data
      )
    },
  })
}
