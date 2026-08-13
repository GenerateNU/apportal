import { notFound } from 'next/navigation'
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
import { getCurrentUser } from '@/generated/users/users'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import type { Cycle } from '@/lib/api/types'
import { pickDefaultCycleId } from '@/lib/queries/cycles'
import { queryKeys } from '@/lib/queries/keys'
import { ChiefReviewQueueClient } from './components/ChiefReviewQueueClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

// Chief/admin only. The sidebar hides this link from leads, but that alone
// leaves the route reachable by URL, so the check is repeated here on the
// server. The backend is still the actual boundary — every chief-review read
// endpoint calls requireChief — this just avoids rendering a page whose every
// request would 403.
async function isChief(): Promise<boolean> {
  try {
    const user = await getCurrentUser(await getServerRequestOptions())
    return (user.roles ?? []).some(
      (role) => role === 'chief' || role === 'admin'
    )
  } catch {
    return false
  }
}

export default async function ChiefReviewQueuePage() {
  if (!(await isChief())) notFound()

  const queryClient = new QueryClient()
  const requestOptions = await getServerRequestOptions()

  // Prefetch under the exact keys the client mounts with: the cycle list, then
  // the application list scoped to the cycle it defaults to. Both role and
  // stage start at "all" (advancing an application to chief_review is a
  // manual, rarely-taken action, so filtering to it by default hid almost
  // everything), which the client omits from the params entirely. Both sides
  // must pick the cycle the same way — pickDefaultCycleId, not
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
    const params: ApplicationListParams = { cycle_id: cycleId }
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
