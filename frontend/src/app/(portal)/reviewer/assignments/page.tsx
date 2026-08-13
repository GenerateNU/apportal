import { notFound } from 'next/navigation'
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { fetchApplicationPage } from '@/lib/queries/applications'
import { getCurrentUser, listUsers } from '@/generated/users/users'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import { queryKeys } from '@/lib/queries/keys'
import { AssignmentsClient } from './components/AssignmentsClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

// Chief/admin only. The sidebar hides this link from leads, but that alone
// leaves the route reachable by URL, so the check is repeated here on the
// server. The backend is still the actual boundary — every lead-assignment
// mutation calls requireChief — this just avoids rendering a page whose every
// request would 403.
async function isChief(): Promise<boolean> {
  try {
    const user = await getCurrentUser(await getServerRequestOptions())
    return (user.roles ?? []).some(
      (role) => role === 'chief' || role === 'admin'
    )
  } catch {
    return false
  }
}

export default async function AssignmentsPage() {
  if (!(await isChief())) notFound()

  const queryClient = new QueryClient()
  const requestOptions = await getServerRequestOptions()

  // Applicant names come back on the list rows themselves (the backend joins
  // users), so there's nothing to fetch per applicant here.
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.applications.list({}),
      queryFn: () => fetchApplicationPage({}, requestOptions),
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
