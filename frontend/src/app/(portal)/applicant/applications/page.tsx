import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { listOpenApplicationTemplates } from '@/generated/application-templates/application-templates'
import { listCycles } from '@/generated/cycles/cycles'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import { queryKeys } from '@/lib/queries/keys'
import { ApplicationsClient } from './components/ApplicationsClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

export default async function ApplicationsPage() {
  const queryClient = new QueryClient()
  const requestOptions = await getServerRequestOptions()

  // Cycles are the same for everyone; the applicant's own applications are
  // fetched client-side once their signed-in identity resolves.
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.cycles.list({}),
      queryFn: async () => (await listCycles({}, requestOptions)) ?? [],
    }),
    // Which roles are actually visible ("cycle open AND template open") is
    // decided server-side by this one query — no client-side status joins.
    queryClient.prefetchQuery({
      queryKey: queryKeys.applicationTemplates.openList(),
      queryFn: async () =>
        (await listOpenApplicationTemplates(requestOptions)) ?? [],
    }),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ApplicationsClient />
    </HydrationBoundary>
  )
}
