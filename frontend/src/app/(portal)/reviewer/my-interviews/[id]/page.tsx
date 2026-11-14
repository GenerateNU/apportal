import { notFound } from 'next/navigation'
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { listAnswers } from '@/generated/answers/answers'
import { getApplicant } from '@/generated/applicants/applicants'
import { getApplication } from '@/generated/applications/applications'
import {
  getInterview,
  listInterviewComments,
} from '@/generated/interviews/interviews'
import { listCycleQuestions } from '@/generated/questions/questions'
import { listInterviewReviewers } from '@/generated/recording-reviews/recording-reviews'
import type { Application, Interview } from '@/lib/api/types'
import { APIError } from '@/lib/api/client'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import { queryKeys } from '@/lib/queries/keys'
import { InterviewConductClient } from './components/InterviewConductClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

export default async function InterviewConductPage({
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

  const role = application.role_id

  // Fetched directly (not through queryClient.fetchQuery) because "no
  // interview yet" is a real, common outcome here, and TanStack's fetchQuery
  // rejects if a queryFn resolves to undefined — fine for prefetchQuery
  // (which swallows the rejection) but fatal for an awaited fetchQuery. The
  // client's own useInterview() still fetches this normally on mount.
  let interview: Interview | undefined
  try {
    interview = (await getInterview(id, requestOptions)) as Interview
    queryClient.setQueryData(queryKeys.interviews.detail(id), interview)
  } catch (err) {
    interview = undefined
    if (err instanceof APIError && err.status === 404) {
      queryClient.setQueryData(queryKeys.interviews.detail(id), null)
    }
  }

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.answers.list(id),
      queryFn: () => listAnswers(id, requestOptions),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.questions.list(application.cycle_id, role),
      queryFn: () =>
        listCycleQuestions(
          application.cycle_id,
          { role_id: role },
          requestOptions
        ),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.applicants.detail(application.user_nuid),
      queryFn: () => getApplicant(application.user_nuid, requestOptions),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.interviewComments.list(id),
      queryFn: () => listInterviewComments(id, requestOptions),
    }),
    ...(interview
      ? [
          queryClient.prefetchQuery({
            queryKey: queryKeys.recordingReviews.list(id),
            queryFn: () => listInterviewReviewers(id, requestOptions),
          }),
        ]
      : []),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <InterviewConductClient
        applicationId={id}
        cycleId={application.cycle_id}
        role={role}
        applicantNuid={application.user_nuid}
      />
    </HydrationBoundary>
  )
}
