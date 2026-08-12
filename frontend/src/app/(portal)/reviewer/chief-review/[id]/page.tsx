import { notFound } from 'next/navigation'
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { listAnswers } from '@/generated/answers/answers'
import { getApplicant } from '@/generated/applicants/applicants'
import { getApplication } from '@/generated/applications/applications'
import { listChiefReviews } from '@/generated/chief-reviews/chief-reviews'
import { listCycleQuestions } from '@/generated/questions/questions'
import { listCycleReviewQuestions } from '@/generated/review-questions/review-questions'
import { listWrittenReviews } from '@/generated/written-reviews/written-reviews'
import type { Application, Role } from '@/lib/api/types'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import { queryKeys } from '@/lib/queries/keys'
import { ChiefReviewClient } from './components/ChiefReviewClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

export default async function ChiefReviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const queryClient = new QueryClient()
  const requestOptions = await getServerRequestOptions()

  let application: Application
  try {
    application = (await queryClient.fetchQuery({
      queryKey: queryKeys.applications.detail(id),
      queryFn: () => getApplication(id, requestOptions),
    })) as Application
  } catch {
    notFound()
  }

  const role = application.role as Role

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.answers.list(id),
      queryFn: () => listAnswers(id, requestOptions),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.questions.list(application.cycle_id, role),
      queryFn: () =>
        listCycleQuestions(application.cycle_id, { role }, requestOptions),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.writtenReviews.list(id),
      queryFn: () => listWrittenReviews(id, requestOptions),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.reviewQuestions.list(application.cycle_id, role),
      queryFn: () =>
        listCycleReviewQuestions(
          application.cycle_id,
          { role },
          requestOptions
        ),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.chiefReviews.list(id),
      queryFn: () => listChiefReviews(id, requestOptions),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.applicants.detail(application.user_nuid),
      queryFn: () => getApplicant(application.user_nuid, requestOptions),
    }),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ChiefReviewClient
        applicationId={id}
        cycleId={application.cycle_id}
        role={role}
        applicantNuid={application.user_nuid}
      />
    </HydrationBoundary>
  )
}
