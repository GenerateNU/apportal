import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { getApplications } from '@/lib/api/applications'
import { getApplicant } from '@/lib/api/applicants'
import { queryKeys } from '@/lib/queries/keys'
import { REVIEWER_ACTOR } from '@/lib/stub-actor'
import { ApplicantsClient } from './components/ApplicantsClient'

export default async function ApplicantsPage() {
  const queryClient = new QueryClient()

  const applications = await queryClient.fetchQuery({
    queryKey: queryKeys.applications.list({}),
    queryFn: () =>
      getApplications({}, { actor: REVIEWER_ACTOR, cache: 'no-store' }),
  })

  const uniqueNUIDs = [...new Set(applications.map((a) => a.user_nuid))]
  await Promise.all(
    uniqueNUIDs.map((nuid) =>
      queryClient.prefetchQuery({
        queryKey: queryKeys.applicants.detail(nuid),
        queryFn: () =>
          getApplicant(nuid, { actor: REVIEWER_ACTOR, cache: 'no-store' }),
      })
    )
  )

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ApplicantsClient />
    </HydrationBoundary>
  )
}
