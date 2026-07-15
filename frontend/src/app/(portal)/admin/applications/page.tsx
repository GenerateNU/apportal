import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { getApplications } from '@/lib/api/applications'
import { getChallenges } from '@/lib/api/challenges'
import { getCycles } from '@/lib/api/cycles'
import { getQuestions } from '@/lib/api/questions'
import { queryKeys } from '@/lib/queries/keys'
import { REVIEWER_ACTOR } from '@/lib/stub-actor'
import { ApplicationsClient } from './components/ApplicationsClient'

export default async function ApplicationsPage() {
  const queryClient = new QueryClient()

  const cycles = await queryClient.fetchQuery({
    queryKey: queryKeys.cycles.lists(),
    queryFn: () => getCycles({ actor: REVIEWER_ACTOR, cache: 'no-store' }),
  })

  await queryClient.prefetchQuery({
    queryKey: queryKeys.applications.list({}),
    queryFn: () =>
      getApplications({}, { actor: REVIEWER_ACTOR, cache: 'no-store' }),
  })

  await Promise.all(
    cycles.flatMap((cycle) => [
      queryClient.prefetchQuery({
        queryKey: queryKeys.questions.list(cycle.id),
        queryFn: () =>
          getQuestions(cycle.id, undefined, {
            actor: REVIEWER_ACTOR,
            cache: 'no-store',
          }),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.challenges.list(cycle.id),
        queryFn: () =>
          getChallenges(cycle.id, undefined, {
            actor: REVIEWER_ACTOR,
            cache: 'no-store',
          }),
      }),
    ])
  )

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ApplicationsClient />
    </HydrationBoundary>
  )
}
