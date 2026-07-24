import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { getApplicationTemplate } from '@/generated/application-templates/application-templates'
import { cycleTemplateSummary, listCycles } from '@/generated/cycles/cycles'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import { queryKeys } from '@/lib/queries/keys'
import { ROLE_COLUMNS } from '@/lib/roles'
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

  await Promise.all([
    ...cycles.map((cycle) =>
      queryClient.prefetchQuery({
        queryKey: queryKeys.cycles.templateSummary(cycle.id),
        queryFn: async () =>
          (await cycleTemplateSummary(cycle.id, requestOptions)) ?? [],
      })
    ),
    ...cycles.flatMap((cycle) =>
      ROLE_COLUMNS.map((role) =>
        queryClient.prefetchQuery({
          queryKey: queryKeys.applicationTemplates.detail(cycle.id, role),
          queryFn: () =>
            getApplicationTemplate(cycle.id, { role }, requestOptions),
        })
      )
    ),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ApplicationsClient />
    </HydrationBoundary>
  )
}
