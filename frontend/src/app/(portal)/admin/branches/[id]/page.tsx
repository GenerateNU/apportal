import { notFound } from 'next/navigation'
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
import { BranchDetailClient } from './components/BranchDetailClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

export default async function BranchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const queryClient = new QueryClient()
  const requestOptions = await getServerRequestOptions()

  // The list rather than one branch: it's already cached from the Branches page.
  const [branches] = await Promise.all([
    queryClient.fetchQuery({
      queryKey: queryKeys.branches.list(),
      queryFn: () => fetchBranches(requestOptions),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.cycles.list({ branch_id: id }),
      queryFn: () => fetchCycles({ branch_id: id }, requestOptions),
    }),
    prefetchRoles(queryClient, requestOptions),
  ])
  if (!branches.some((b) => b.id === id)) notFound()

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <BranchDetailClient branchId={id} />
    </HydrationBoundary>
  )
}
