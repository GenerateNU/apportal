import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { listCycles } from '@/generated/cycles/cycles'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import { fetchBranches } from '@/lib/queries/branches'
import { queryKeys } from '@/lib/queries/keys'
import { prefetchRoles } from '@/lib/queries/server-prefetch'
import { CyclesClient } from './components/CyclesClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

export default async function CyclesPage() {
  const queryClient = new QueryClient()
  const requestOptions = await getServerRequestOptions()

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.branches.list(),
      queryFn: () => fetchBranches(requestOptions),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.cycles.list({}),
      queryFn: async () => (await listCycles({}, requestOptions)) ?? [],
    }),
    prefetchRoles(queryClient, requestOptions),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CyclesClient />
    </HydrationBoundary>
  )
}
