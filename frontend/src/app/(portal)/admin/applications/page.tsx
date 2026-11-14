import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { getApplicationTemplate } from '@/generated/application-templates/application-templates'
import { cycleTemplateSummary, listCycles } from '@/generated/cycles/cycles'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
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

  // Each cycle's summary lists its roles, which pick the templates.
  const [pairs] = await Promise.all([
    Promise.all(
      cycles.map((cycle) =>
        queryClient
          .fetchQuery({
            queryKey: queryKeys.cycles.templateSummary(cycle.id),
            queryFn: async () =>
              (await cycleTemplateSummary(cycle.id, requestOptions)) ?? [],
          })
          .then((rows) =>
            rows.map((s) => ({ cycleId: cycle.id, roleId: s.role_id }))
          )
          .catch(() => [])
      )
    ).then((perCycle) => perCycle.flat()),
    prefetchRoles(queryClient, requestOptions),
  ])
  await Promise.all(
    pairs.map(({ cycleId, roleId }) =>
      queryClient.prefetchQuery({
        queryKey: queryKeys.applicationTemplates.detail(cycleId, roleId),
        queryFn: () =>
          getApplicationTemplate(cycleId, { role_id: roleId }, requestOptions),
      })
    )
  )

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ApplicationsClient />
    </HydrationBoundary>
  )
}
