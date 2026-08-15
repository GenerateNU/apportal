import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { listCycles } from '@/generated/cycles/cycles'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import { fetchApplicationPage } from '@/lib/queries/applications'
import { pickDefaultCycleId } from '@/lib/queries/cycles'
import { queryKeys } from '@/lib/queries/keys'
import { InterviewRatingsClient } from './components/InterviewRatingsClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

export default async function InterviewRatingsPage() {
  const queryClient = new QueryClient()
  const requestOptions = await getServerRequestOptions()

  const cycles = await queryClient.fetchQuery({
    queryKey: queryKeys.cycles.list({}),
    queryFn: async () => (await listCycles({}, requestOptions)) ?? [],
  })
  const cycleId = pickDefaultCycleId(cycles)

  if (cycleId) {
    const params = { cycle_id: cycleId }
    await queryClient.prefetchQuery({
      queryKey: queryKeys.applications.list(params),
      queryFn: () => fetchApplicationPage(params, requestOptions),
    })
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <InterviewRatingsClient />
    </HydrationBoundary>
  )
}
