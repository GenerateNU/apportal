import type { QueryClient } from '@tanstack/react-query'
import { getApplicationTemplate } from '@/generated/application-templates/application-templates'
import { getCycle } from '@/generated/cycles/cycles'
import { listCycleQuestions } from '@/generated/questions/questions'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { Cycle, Role } from '@/lib/api/types'
import { queryKeys } from '@/lib/queries/keys'
import { prefetchRoles } from '@/lib/queries/server-prefetch'

// Everything the form builder mounts with. Null when the role isn't one of
// the cycle's, so the caller can 404.
export async function prefetchFormBuilder(
  queryClient: QueryClient,
  cycleId: string,
  roleId: string,
  opts: RequestOptions
): Promise<{ cycle: Cycle; role: Role } | null> {
  const [cycle, roles] = await Promise.all([
    queryClient.fetchQuery({
      queryKey: queryKeys.cycles.detail(cycleId),
      queryFn: () => getCycle(cycleId, opts) as Promise<Cycle>,
    }),
    prefetchRoles(queryClient, opts),
  ])
  const role = roles.find((r) => r.id === roleId && r.cycle_id === cycleId)
  if (!role) return null

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.questions.list(cycleId, roleId),
      queryFn: () => listCycleQuestions(cycleId, { role_id: roleId }, opts),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.applicationTemplates.detail(cycleId, roleId),
      queryFn: () => getApplicationTemplate(cycleId, { role_id: roleId }, opts),
    }),
  ])
  return { cycle, role }
}
