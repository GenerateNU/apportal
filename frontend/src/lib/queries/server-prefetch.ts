import type { QueryClient } from '@tanstack/react-query'
import { getInterviewScript } from '@/generated/interview-script/interview-script'
import { listUsers } from '@/generated/users/users'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { Cycle, InterviewScript, Role, User } from '@/lib/api/types'
import { fetchCycles, pickDefaultCycleId } from './cycles'
import { queryKeys } from './keys'
import { fetchRoles } from './roles'
import { cycleRoleIds, defaultRoleId } from '@/lib/roles'

export { cycleRoleIds, defaultRoleId }

// Server-only prefetches shared across pages. A failure falls back to letting
// the client fetch rather than failing the whole render.

export function prefetchCycles(
  queryClient: QueryClient,
  opts: RequestOptions
): Promise<Cycle[]> {
  return queryClient
    .fetchQuery({
      queryKey: queryKeys.cycles.list({}),
      queryFn: () => fetchCycles({}, opts),
    })
    .catch(() => [])
}

export function prefetchRoles(
  queryClient: QueryClient,
  opts: RequestOptions
): Promise<Role[]> {
  return queryClient
    .fetchQuery({
      queryKey: queryKeys.roles.list(),
      queryFn: () => fetchRoles(opts),
    })
    .catch(() => [])
}

// The interview-script view and editor resolve cycle and role the same way.
export async function prefetchInterviewScript(
  queryClient: QueryClient,
  searchParams: { cycle?: string; role?: string },
  opts: RequestOptions
) {
  const [cycles, roles] = await Promise.all([
    prefetchCycles(queryClient, opts),
    prefetchRoles(queryClient, opts),
  ])
  const cycleId = searchParams.cycle || pickDefaultCycleId(cycles)
  if (!cycleId) return
  const roleId = searchParams.role || defaultRoleId(roles, cycleId)
  if (!roleId) return
  await queryClient.prefetchQuery({
    queryKey: queryKeys.interviewScript.detail(cycleId, roleId),
    queryFn: () =>
      getInterviewScript(
        cycleId,
        { role_id: roleId },
        opts
      ) as Promise<InterviewScript>,
  })
}

// Matches the keys useLeads/useChiefs read.
export function prefetchUsersByRole(
  queryClient: QueryClient,
  role: 'lead' | 'chief',
  opts: RequestOptions
) {
  return queryClient.prefetchQuery({
    queryKey: [...queryKeys.users.lists(), role],
    queryFn: async () =>
      ((await listUsers({ role }, opts))?.users ?? []) as User[],
  })
}
