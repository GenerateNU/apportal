import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import { fetchBranches } from '@/lib/queries/branches'
import { fetchCycles } from '@/lib/queries/cycles'
import { queryKeys } from '@/lib/queries/keys'
import { prefetchRoles } from '@/lib/queries/server-prefetch'
import { BranchesClient } from './components/BranchesClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

export default async function BranchesPage() {
  const queryClient = new QueryClient()
  const requestOptions = await getServerRequestOptions()

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.branches.list(),
      queryFn: () => fetchBranches(requestOptions),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.cycles.list({}),
      queryFn: () => fetchCycles({}, requestOptions),
    }),
    prefetchRoles(queryClient, requestOptions),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <BranchesClient />
    </HydrationBoundary>
  )
}
