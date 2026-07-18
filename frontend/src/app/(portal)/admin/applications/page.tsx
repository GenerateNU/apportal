import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { listApplications } from '@/generated/applications/applications'
import { listCycleChallenges } from '@/generated/code-challenges/code-challenges'
import { listCycles } from '@/generated/cycles/cycles'
import { listCycleQuestions } from '@/generated/questions/questions'
import { queryKeys } from '@/lib/queries/keys'
import { REVIEWER_ACTOR } from '@/lib/stub-actor'
import { ApplicationsClient } from './components/ApplicationsClient'

export default async function ApplicationsPage() {
  const queryClient = new QueryClient()

  const cycles = await queryClient.fetchQuery({
    queryKey: queryKeys.cycles.lists(),
    queryFn: async () => (await listCycles({ actor: REVIEWER_ACTOR })) ?? [],
  })

  await queryClient.prefetchQuery({
    queryKey: queryKeys.applications.list({}),
    queryFn: () => listApplications({}, { actor: REVIEWER_ACTOR }),
  })

  await Promise.all(
    cycles.flatMap((cycle) => [
      queryClient.prefetchQuery({
        queryKey: queryKeys.questions.list(cycle.id),
        queryFn: () =>
          listCycleQuestions(cycle.id, undefined, { actor: REVIEWER_ACTOR }),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.challenges.list(cycle.id),
        queryFn: () =>
          listCycleChallenges(cycle.id, undefined, { actor: REVIEWER_ACTOR }),
      }),
    ])
  )

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ApplicationsClient />
    </HydrationBoundary>
  )
}
