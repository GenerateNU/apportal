import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { listCycles } from '@/generated/cycles/cycles'
import { queryKeys } from '@/lib/queries/keys'
import { ApplicationsClient } from './components/ApplicationsClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

export default async function ApplicationsPage() {
  const queryClient = new QueryClient()

  // Cycles are the same for everyone; the applicant's own applications are
  // fetched client-side once their signed-in identity resolves.
  await queryClient.prefetchQuery({
    queryKey: queryKeys.cycles.lists(),
    queryFn: async () => (await listCycles()) ?? [],
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ApplicationsClient />
    </HydrationBoundary>
  )
}
