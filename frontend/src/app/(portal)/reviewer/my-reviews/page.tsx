import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { listApplications } from '@/generated/applications/applications'
import { listCycles } from '@/generated/cycles/cycles'
import { getCurrentUser } from '@/generated/users/users'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import type { Cycle } from '@/lib/api/types'
import { queryKeys } from '@/lib/queries/keys'
import { ReviewQueueClient } from './components/ReviewQueueClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

export default async function ReviewQueuePage() {
  const queryClient = new QueryClient()
  const requestOptions = await getServerRequestOptions()

  // The client mounts scoped to "assigned to me", so the list it asks for is
  // keyed by the caller's own nuid — resolve that here so the prefetch lands
  // under the same key instead of one the browser has to refetch.
  const [me] = await Promise.all([
    getCurrentUser(requestOptions),
    queryClient.prefetchQuery({
      queryKey: queryKeys.cycles.list({}),
      queryFn: async () =>
        ((await listCycles({}, requestOptions)) ?? []) as Cycle[],
    }),
  ])

  const params = { assigned_to: me.nuid }
  await queryClient.prefetchQuery({
    queryKey: queryKeys.applications.list(params),
    queryFn: async () => (await listApplications(params, requestOptions)) ?? [],
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ReviewQueueClient />
    </HydrationBoundary>
  )
}
