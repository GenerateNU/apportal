import { notFound } from 'next/navigation'
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { listAnswers } from '@/generated/answers/answers'
import { getApplicant } from '@/generated/applicants/applicants'
import { getApplication } from '@/generated/applications/applications'
import { listCycleQuestions } from '@/generated/questions/questions'
import { listWrittenReviews } from '@/generated/written-reviews/written-reviews'
import type { Application, Role } from '@/lib/api/types'
import { queryKeys } from '@/lib/queries/keys'
import { REVIEWER_ACTOR } from '@/lib/stub-actor'
import { ReviewClient } from './components/ReviewClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const queryClient = new QueryClient()

  let application: Application
  try {
    application = (await queryClient.fetchQuery({
      queryKey: queryKeys.applications.detail(id),
      queryFn: () => getApplication(id, { actor: REVIEWER_ACTOR }),
    })) as Application
  } catch {
    notFound()
  }

  const role = application.role as Role

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.answers.list(id),
      queryFn: () => listAnswers(id, { actor: REVIEWER_ACTOR }),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.questions.list(application.cycle_id, role),
      queryFn: () =>
        listCycleQuestions(
          application.cycle_id,
          { role },
          { actor: REVIEWER_ACTOR }
        ),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.writtenReviews.list(id),
      queryFn: () => listWrittenReviews(id, { actor: REVIEWER_ACTOR }),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.applicants.detail(application.user_nuid),
      queryFn: () =>
        getApplicant(application.user_nuid, { actor: REVIEWER_ACTOR }),
    }),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ReviewClient
        applicationId={id}
        cycleId={application.cycle_id}
        role={role}
        applicantNuid={application.user_nuid}
      />
    </HydrationBoundary>
  )
}
