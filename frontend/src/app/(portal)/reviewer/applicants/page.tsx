import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { listApplications } from '@/generated/applications/applications'
import { getApplicant } from '@/generated/applicants/applicants'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import { queryKeys } from '@/lib/queries/keys'
import { ApplicantsClient } from './components/ApplicantsClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

export default async function ApplicantsPage() {
  const queryClient = new QueryClient()
  const requestOptions = await getServerRequestOptions()

  const applications = await queryClient.fetchQuery({
    queryKey: queryKeys.applications.list({}),
    queryFn: async () => (await listApplications({}, requestOptions)) ?? [],
  })

  const uniqueNUIDs = [...new Set(applications.map((a) => a.user_nuid))]
  await Promise.all(
    uniqueNUIDs.map((nuid) =>
      queryClient.prefetchQuery({
        queryKey: queryKeys.applicants.detail(nuid),
        queryFn: () => getApplicant(nuid, requestOptions),
      })
    )
  )

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ApplicantsClient />
    </HydrationBoundary>
  )
}
