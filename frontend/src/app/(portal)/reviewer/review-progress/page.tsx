import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { listCycles } from '@/generated/cycles/cycles'
import { listReviewerProgress } from '@/generated/review-releases/review-releases'
import { listUsers } from '@/generated/users/users'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import { queryKeys } from '@/lib/queries/keys'
import { ROLE_COLUMNS } from '@/lib/roles'
import { ReviewProgressClient } from './components/ReviewProgressClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

export default async function ReviewProgressPage() {
  const queryClient = new QueryClient()
  const requestOptions = await getServerRequestOptions()

  const cycles = await queryClient.fetchQuery({
    queryKey: queryKeys.cycles.list({}),
    queryFn: async () => (await listCycles({}, requestOptions)) ?? [],
  })
  const cycleId = (cycles.find((c) => c.status === 'open') ?? cycles[0])?.id

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: [...queryKeys.users.lists(), 'lead'],
      queryFn: async () =>
        (await listUsers({ role: 'lead' }, requestOptions))?.users ?? [],
    }),
    ...(cycleId
      ? ROLE_COLUMNS.map((role) =>
          queryClient.prefetchQuery({
            queryKey: queryKeys.reviewerProgress.list(cycleId, role),
            queryFn: async () =>
              (await listReviewerProgress(cycleId, { role }, requestOptions)) ??
              [],
          })
        )
      : []),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ReviewProgressClient />
    </HydrationBoundary>
  )
}
