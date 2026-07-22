import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { getApplicationTemplate } from '@/generated/application-templates/application-templates'
import { listCycles } from '@/generated/cycles/cycles'
import { queryKeys } from '@/lib/queries/keys'
import { ROLE_COLUMNS } from '@/lib/roles'
import { ApplicationsClient } from './components/ApplicationsClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

export default async function ApplicationsPage() {
  const queryClient = new QueryClient()

  // Cycles are the same for everyone; the applicant's own applications are
  // fetched client-side once their signed-in identity resolves.
  const cycles = await queryClient.fetchQuery({
    queryKey: queryKeys.cycles.list({}),
    queryFn: async () => (await listCycles({})) ?? [],
  })

  // Per-role templates decide whether a role is actually visible to
  // applicants (see ApplicationsClient) — prefetch every role's template for
  // every cycle so that decision doesn't wait on a second round trip.
  await Promise.all(
    cycles.flatMap((cycle) =>
      ROLE_COLUMNS.map((role) =>
        queryClient.prefetchQuery({
          queryKey: queryKeys.applicationTemplates.detail(cycle.id, role),
          queryFn: () => getApplicationTemplate(cycle.id, { role }),
        })
      )
    )
  )

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ApplicationsClient />
    </HydrationBoundary>
  )
}
