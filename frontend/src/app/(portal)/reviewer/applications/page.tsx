import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { listApplications } from '@/generated/applications/applications'
import { listCycles } from '@/generated/cycles/cycles'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import type { Cycle } from '@/lib/api/types'
import { defaultApplicationsCycleId } from '@/lib/cycles'
import { queryKeys } from '@/lib/queries/keys'
import { ROLE_COLUMNS } from '@/lib/roles'
import { ApplicationsClient } from './components/ApplicationsClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

export default async function ApplicationsPage() {
  const queryClient = new QueryClient()
  const requestOptions = await getServerRequestOptions()

  // Prefetch exactly the two queries the client mounts with — the cycle list,
  // then the application list scoped to the cycle and role it defaults to.
  // A prefetch under any other key (e.g. the unfiltered list) is a cache miss
  // the browser silently refetches, so it costs a round trip and saves none.
  const cycles = await queryClient.fetchQuery({
    queryKey: queryKeys.cycles.list({}),
    queryFn: async () =>
      ((await listCycles({}, requestOptions)) ?? []) as Cycle[],
  })

  const cycleId = defaultApplicationsCycleId(cycles)
  if (cycleId) {
    const params = { cycle_id: cycleId, role: ROLE_COLUMNS[0] }
    await queryClient.prefetchQuery({
      queryKey: queryKeys.applications.list(params),
      queryFn: async () =>
        (await listApplications(params, requestOptions)) ?? [],
    })
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ApplicationsClient />
    </HydrationBoundary>
  )
}
