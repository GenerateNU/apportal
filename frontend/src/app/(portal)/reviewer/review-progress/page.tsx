import { notFound } from 'next/navigation'
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { listCycles } from '@/generated/cycles/cycles'
import { listReviewerProgress } from '@/generated/review-releases/review-releases'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import { pickDefaultCycleId } from '@/lib/queries/cycles'
import { queryKeys } from '@/lib/queries/keys'
import { ReviewProgressClient } from './components/ReviewProgressClient'
import { getServerCurrentUser } from '@/lib/auth/server-user'
import { cycleRoleIds, prefetchRoles } from '@/lib/queries/server-prefetch'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

// Chief/admin only. The sidebar hides this link from leads, but that alone
// leaves the route reachable by URL, so the check is repeated here on the
// server. The backend is still the actual boundary — list-reviewer-progress
// calls requireChief — this just avoids rendering a page whose every request
// would 403.
async function isChief(): Promise<boolean> {
  try {
    const user = await getServerCurrentUser()
    return (user.roles ?? []).some(
      (role) => role === 'chief' || role === 'admin'
    )
  } catch {
    return false
  }
}

export default async function ReviewProgressPage() {
  if (!(await isChief())) notFound()

  const queryClient = new QueryClient()
  const requestOptions = await getServerRequestOptions()

  const [cycles, roles] = await Promise.all([
    queryClient.fetchQuery({
      queryKey: queryKeys.cycles.list({}),
      queryFn: async () => (await listCycles({}, requestOptions)) ?? [],
    }),
    prefetchRoles(queryClient, requestOptions),
  ])
  const cycleId = pickDefaultCycleId(cycles)

  await Promise.all(
    cycleId
      ? cycleRoleIds(roles, cycleId).map((role) =>
          queryClient.prefetchQuery({
            queryKey: queryKeys.reviewerProgress.list(cycleId, role),
            queryFn: async () =>
              (await listReviewerProgress(
                cycleId,
                { role_id: role },
                requestOptions
              )) ?? [],
          })
        )
      : []
  )

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ReviewProgressClient />
    </HydrationBoundary>
  )
}
