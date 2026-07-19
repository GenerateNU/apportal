import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { getApplicant } from '@/generated/applicants/applicants'
import { listApplications } from '@/generated/applications/applications'
import { listUsers } from '@/generated/users/users'
import { queryKeys } from '@/lib/queries/keys'
import { REVIEWER_ACTOR } from '@/lib/stub-actor'
import { AssignmentsClient } from './components/AssignmentsClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

export default async function AssignmentsPage() {
  const queryClient = new QueryClient()

  const applications = await queryClient.fetchQuery({
    queryKey: queryKeys.applications.list({}),
    queryFn: async () =>
      (await listApplications({}, { actor: REVIEWER_ACTOR })) ?? [],
  })

  const uniqueNUIDs = [...new Set(applications.map((a) => a.user_nuid))]
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: [...queryKeys.users.lists(), 'lead'],
      queryFn: () => listUsers({ role: 'lead' }, { actor: REVIEWER_ACTOR }),
    }),
    ...uniqueNUIDs.map((nuid) =>
      queryClient.prefetchQuery({
        queryKey: queryKeys.applicants.detail(nuid),
        queryFn: () => getApplicant(nuid, { actor: REVIEWER_ACTOR }),
      })
    ),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AssignmentsClient />
    </HydrationBoundary>
  )
}
