import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { fetchApplicationPage } from '@/lib/queries/applications'
import { listCycles } from '@/generated/cycles/cycles'
import { getCurrentUser } from '@/generated/users/users'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import type { Cycle } from '@/lib/api/types'
import { queryKeys } from '@/lib/queries/keys'
import { MyInterviewsClient } from './components/MyInterviewsClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

export default async function MyInterviewsPage() {
  const queryClient = new QueryClient()
  const requestOptions = await getServerRequestOptions()

  // The list is keyed by the caller's own nuid, so resolve that here for the
  // prefetch to land under the same key the client asks for.
  const [me] = await Promise.all([
    getCurrentUser(requestOptions),
    queryClient.prefetchQuery({
      queryKey: queryKeys.cycles.list({}),
      queryFn: async () =>
        ((await listCycles({}, requestOptions)) ?? []) as Cycle[],
    }),
  ])

  const params = { interviewer_nuid: me.nuid }
  await queryClient.prefetchQuery({
    queryKey: queryKeys.applications.list(params),
    queryFn: () => fetchApplicationPage(params, requestOptions),
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <MyInterviewsClient />
    </HydrationBoundary>
  )
}
