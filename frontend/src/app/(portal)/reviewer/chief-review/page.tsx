import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import {
  fetchApplicationPage,
  type ApplicationListParams,
} from '@/lib/queries/applications'
import { listCycles } from '@/generated/cycles/cycles'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import type { Cycle } from '@/lib/api/types'
import { pickDefaultCycleId } from '@/lib/queries/cycles'
import { queryKeys } from '@/lib/queries/keys'
import { ChiefReviewQueueClient } from './components/ChiefReviewQueueClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

export default async function ChiefReviewQueuePage() {
  const queryClient = new QueryClient()
  const requestOptions = await getServerRequestOptions()

  // Prefetch under the exact keys the client mounts with: the cycle list, then
  // the application list scoped to the cycle and stage it defaults to (role
  // starts at "all", which the client omits from the params entirely). Both
  // sides must pick the cycle the same way — pickDefaultCycleId, not
  // defaultPipelineCycleId — or this prefetch warms a cache entry the client
  // never reads, and every visit refetches over the network instead of
  // hydrating.
  const cycles = await queryClient.fetchQuery({
    queryKey: queryKeys.cycles.list({}),
    queryFn: async () =>
      ((await listCycles({}, requestOptions)) ?? []) as Cycle[],
  })

  const cycleId = pickDefaultCycleId(cycles)
  if (cycleId) {
    const params: ApplicationListParams = {
      cycle_id: cycleId,
      stage: 'chief_review',
    }
    await queryClient.prefetchQuery({
      queryKey: queryKeys.applications.list(params),
      queryFn: () => fetchApplicationPage(params, requestOptions),
    })
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ChiefReviewQueueClient />
    </HydrationBoundary>
  )
}
