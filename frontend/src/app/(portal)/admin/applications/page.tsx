import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { listCycles } from '@/generated/cycles/cycles'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import { fetchCycleTemplateSummaries } from '@/lib/queries/cycles'
import { queryKeys } from '@/lib/queries/keys'
import { prefetchRoles } from '@/lib/queries/server-prefetch'
import { ApplicationsClient } from './components/ApplicationsClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

export default async function ApplicationsPage() {
  const queryClient = new QueryClient()
  const requestOptions = await getServerRequestOptions()

  const cycles = await queryClient.fetchQuery({
    queryKey: queryKeys.cycles.list({}),
    queryFn: async () => (await listCycles({}, requestOptions)) ?? [],
  })

  const cycleIds = cycles.map((c) => c.id)
  await Promise.all([
    queryClient
      .prefetchQuery({
        queryKey: queryKeys.cycles.templateSummaries(cycleIds),
        queryFn: () =>
          fetchCycleTemplateSummaries(cycleIds, queryClient, requestOptions),
      })
      .catch(() => {}),
    prefetchRoles(queryClient, requestOptions),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ApplicationsClient />
    </HydrationBoundary>
  )
}
