import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { listApplications } from '@/generated/applications/applications'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import { queryKeys } from '@/lib/queries/keys'
import { InterviewAssignmentsClient } from './components/InterviewAssignmentsClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

export default async function InterviewAssignmentsPage() {
  const queryClient = new QueryClient()
  const requestOptions = await getServerRequestOptions()

  // Applicant names come back on the list rows themselves (the backend joins
  // users), so there's nothing to fetch per applicant here.
  await queryClient.prefetchQuery({
    queryKey: queryKeys.applications.list({}),
    queryFn: async () => (await listApplications({}, requestOptions)) ?? [],
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <InterviewAssignmentsClient />
    </HydrationBoundary>
  )
}
