import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createRole,
  deleteRole,
  listRoles,
  updateRole,
} from '@/generated/roles/roles'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import { getApplicationTemplate } from '@/generated/application-templates/application-templates'
import type { ApplicationTemplate, Role } from '@/lib/api/types'
import { buildRoleLookup, type RoleLookup } from '@/lib/roles'
import { queryKeys } from './keys'

// Every role across cycles — a small table, so one cached request serves
// every page's labels and colours.
export async function fetchRoles(opts?: RequestOptions) {
  return ((await listRoles(undefined, opts)) ?? []) as Role[]
}

export function useRoles(opts?: RequestOptions) {
  return useQuery({
    queryKey: queryKeys.roles.list(),
    queryFn: () => fetchRoles(opts),
  })
}

// Labels and colours for any role ID, without narrowing to a cycle.
export function useRoleLookup(): RoleLookup & { isLoading: boolean } {
  const { data: roles, isLoading } = useRoles()
  return useMemo(
    () => ({ ...buildRoleLookup(roles ?? []), isLoading }),
    [roles, isLoading]
  )
}

// A cycle's roles, plus lookups for any role.
export function useCycleRoles(
  cycleId: string
): RoleLookup & { isLoading: boolean } {
  const { data: roles, isLoading } = useRoles()
  return useMemo(() => {
    const lookup = buildRoleLookup(roles ?? [], cycleId)
    // No cycle picked yet means no roles, not every role.
    if (!cycleId) return { ...lookup, roles: [], roleIds: [], isLoading }
    return { ...lookup, isLoading }
  }, [roles, cycleId, isLoading])
}

// Also creates the role's draft application: the backend makes the template
// on first fetch. `draft` is null if that failed — the role itself still saved.
export async function createRoleWithDraft(
  body: Parameters<typeof createRole>[0],
  opts?: RequestOptions
): Promise<{ role: Role; draft: ApplicationTemplate | null }> {
  const role = (await createRole(body, opts)) as Role
  const draft = await (
    getApplicationTemplate(
      role.cycle_id,
      { role_id: role.id },
      opts
    ) as Promise<ApplicationTemplate>
  ).catch(() => null)
  return { role, draft }
}

export function useCreateRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      body: Parameters<typeof createRole>[0]
      opts?: RequestOptions
    }) => createRoleWithDraft(vars.body, vars.opts),
    onSuccess: ({ role, draft }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roles.all })
      queryClient.invalidateQueries({
        queryKey: queryKeys.applicationTemplates.cycleList(role.cycle_id),
      })
      if (draft) {
        queryClient.setQueryData(
          queryKeys.applicationTemplates.detail(role.cycle_id, role.id),
          draft
        )
      }
    },
  })
}

export function useUpdateRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      id: string
      body: Parameters<typeof updateRole>[1]
      opts?: RequestOptions
    }) => updateRole(vars.id, vars.body, vars.opts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roles.all })
    },
  })
}

export function useDeleteRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; opts?: RequestOptions }) =>
      deleteRole(vars.id, vars.opts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roles.all })
    },
  })
}
