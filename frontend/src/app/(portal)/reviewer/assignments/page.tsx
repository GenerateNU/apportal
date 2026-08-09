import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { listApplications } from '@/generated/applications/applications'
import { listUsers } from '@/generated/users/users'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import { queryKeys } from '@/lib/queries/keys'
import { AssignmentsClient } from './components/AssignmentsClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

export default async function AssignmentsPage() {
  const queryClient = new QueryClient()
  const requestOptions = await getServerRequestOptions()

  // Applicant names come back on the list rows themselves (the backend joins
  // users), so there's nothing to fetch per applicant here.
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.applications.list({}),
      queryFn: async () => (await listApplications({}, requestOptions)) ?? [],
    }),
    queryClient.prefetchQuery({
      queryKey: [...queryKeys.users.lists(), 'lead'],
      queryFn: async () =>
        (await listUsers({ role: 'lead' }, requestOptions))?.users ?? [],
    }),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AssignmentsClient />
    </HydrationBoundary>
  )
}
