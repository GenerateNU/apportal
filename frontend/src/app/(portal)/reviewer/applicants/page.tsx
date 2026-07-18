import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { listApplications } from '@/generated/applications/applications'
import { getApplicant } from '@/generated/applicants/applicants'
import { queryKeys } from '@/lib/queries/keys'
import { REVIEWER_ACTOR } from '@/lib/stub-actor'
import { ApplicantsClient } from './components/ApplicantsClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

export default async function ApplicantsPage() {
  const queryClient = new QueryClient()

  const applications = await queryClient.fetchQuery({
    queryKey: queryKeys.applications.list({}),
    queryFn: async () =>
      (await listApplications({}, { actor: REVIEWER_ACTOR })) ?? [],
  })

  const uniqueNUIDs = [...new Set(applications.map((a) => a.user_nuid))]
  await Promise.all(
    uniqueNUIDs.map((nuid) =>
      queryClient.prefetchQuery({
        queryKey: queryKeys.applicants.detail(nuid),
        queryFn: () => getApplicant(nuid, { actor: REVIEWER_ACTOR }),
      })
    )
  )

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ApplicantsClient />
    </HydrationBoundary>
  )
}
