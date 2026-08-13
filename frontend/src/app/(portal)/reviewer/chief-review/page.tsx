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
import { fetchChiefReviewsBatch } from '@/lib/queries/chief-reviews'
import { listCycles } from '@/generated/cycles/cycles'
import { getCurrentUser } from '@/generated/users/users'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { Cycle } from '@/lib/api/types'
import { pickDefaultCycleId } from '@/lib/queries/cycles'
import { queryKeys } from '@/lib/queries/keys'
import { fetchReviewerProgress } from '@/lib/queries/reviewer-progress'
import { ROLE_COLUMNS } from '@/lib/roles'
import { ChiefReviewQueueClient } from './components/ChiefReviewQueueClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

// Chief/admin only. The sidebar hides this link from leads, but that alone
// leaves the route reachable by URL, so the check is repeated here on the
// server. The backend is still the actual boundary — every chief-review read
// endpoint calls requireChief — this just avoids rendering a page whose every
// request would 403.
async function isChief(requestOptions: RequestOptions): Promise<boolean> {
  try {
    const user = await getCurrentUser(requestOptions)
    return (user.roles ?? []).some(
      (role) => role === 'chief' || role === 'admin'
    )
  } catch {
    return false
  }
}

export default async function ChiefReviewQueuePage() {
  const requestOptions = await getServerRequestOptions()
  const queryClient = new QueryClient()

  // The chief check and the cycle list don't depend on each other — run them
  // together rather than paying for two sequential round trips before
  // anything else can start.
  const [chiefOk, cycles] = await Promise.all([
    isChief(requestOptions),
    queryClient.fetchQuery({
      queryKey: queryKeys.cycles.list({}),
      queryFn: async () =>
        ((await listCycles({}, requestOptions)) ?? []) as Cycle[],
    }),
  ])
  if (!chiefOk) notFound()

  // Prefetch under the exact keys the client mounts with. Both role and stage
  // start at "all" (advancing an application to chief_review is a manual,
  // rarely-taken action, so filtering to it by default hid almost
  // everything), which the client omits from the params entirely. Both sides
  // must pick the cycle the same way — pickDefaultCycleId, not
  // defaultPipelineCycleId — or this prefetch warms a cache entry the client
  // never reads, and every visit refetches over the network instead of
  // hydrating.
  const cycleId = pickDefaultCycleId(cycles)
  if (cycleId) {
    const params: ApplicationListParams = { cycle_id: cycleId }
    // Applications and reviewer progress don't depend on each other, so fetch
    // them together too. The queue also needs each application's chief
    // reviews, but that request needs the ids this one returns, so it can't
    // join this batch — it follows right after instead of waiting on a full
    // extra client-side round trip post-hydration.
    const [applicationPage] = await Promise.all([
      queryClient.fetchQuery({
        queryKey: queryKeys.applications.list(params),
        queryFn: () => fetchApplicationPage(params, requestOptions),
      }),
      ...ROLE_COLUMNS.map((role) =>
        queryClient.prefetchQuery({
          queryKey: queryKeys.reviewerProgress.list(cycleId, role),
          queryFn: () => fetchReviewerProgress(cycleId, role, requestOptions),
        })
      ),
    ])

    const applicationIds = (applicationPage.applications ?? []).map((a) => a.id)
    if (applicationIds.length > 0) {
      await queryClient.prefetchQuery({
        queryKey: queryKeys.chiefReviews.bulk(applicationIds),
        queryFn: () =>
          fetchChiefReviewsBatch(applicationIds, queryClient, requestOptions),
      })
    }
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ChiefReviewQueueClient />
    </HydrationBoundary>
  )
}
