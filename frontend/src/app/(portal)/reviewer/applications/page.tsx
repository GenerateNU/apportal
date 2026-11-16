import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { fetchApplicationPage } from '@/lib/queries/applications'
import { listCycles } from '@/generated/cycles/cycles'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import type { Cycle } from '@/lib/api/types'
import { defaultApplicationsCycleId } from '@/lib/cycles'
import { queryKeys } from '@/lib/queries/keys'
import { cycleRoleIds, prefetchRoles } from '@/lib/queries/server-prefetch'
import { PAGE_SIZE } from './components/constants'
import { ApplicationsClient } from './components/ApplicationsClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ cycle?: string }>
}) {
  const queryClient = new QueryClient()
  const requestOptions = await getServerRequestOptions()

  // Prefetch exactly the two queries the client mounts with — the cycle list,
  // then the application list scoped to the cycle and role it defaults to.
  // A prefetch under any other key (e.g. the unfiltered list) is a cache miss
  // the browser silently refetches, so it costs a round trip and saves none.
  const [cycles, roles, { cycle: requested }] = await Promise.all([
    queryClient.fetchQuery({
      queryKey: queryKeys.cycles.list(),
      queryFn: async () =>
        ((await listCycles(undefined, requestOptions)) ?? []) as Cycle[],
    }),
    prefetchRoles(queryClient, requestOptions),
    searchParams,
  ])

  // The client may land elsewhere (its remembered cycle); that's just a miss.
  const listed = cycles.filter((c) => c.status !== 'closed')
  const cycleId = listed.some((c) => c.id === requested)
    ? (requested ?? null)
    : defaultApplicationsCycleId(listed)
  const roleIds = cycleId ? cycleRoleIds(roles, cycleId) : []
  if (cycleId && roleIds.length > 0) {
    // The table scrolls to load, so this has to be an infinite prefetch: a
    // plain one caches a bare response where the client expects
    // `{ pages, pageParams }`, and the mismatch costs the round trip it was
    // meant to save. Offset is the page param, so it stays out of the key.
    const params = {
      cycle_id: cycleId,
      ...(roleIds.length === 1
        ? { role_id: roleIds[0] }
        : { role_ids: roleIds.join(',') }),
      limit: PAGE_SIZE,
    }
    await queryClient.prefetchInfiniteQuery({
      queryKey: queryKeys.applications.infiniteList(params),
      queryFn: ({ pageParam }) =>
        fetchApplicationPage({ ...params, cursor: pageParam }, requestOptions),
      initialPageParam: undefined as string | undefined,
    })
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ApplicationsClient />
    </HydrationBoundary>
  )
}
