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
  getInterviewAssignment,
  listRecordingReviewerAssignments,
} from '@/generated/interview-assignments/interview-assignments'
import {
  getInterview,
  listInterviewComments,
} from '@/generated/interviews/interviews'
import { listCycleQuestions } from '@/generated/questions/questions'
import { listRecordingReviews } from '@/generated/recording-reviews/recording-reviews'
import type { Application, Interview, Role } from '@/lib/api/types'
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

  const role = application.role as Role

  // Fetched directly (not through queryClient.fetchQuery) because "no
  // interview yet" is a real, common outcome here, and TanStack's fetchQuery
  // rejects if a queryFn resolves to undefined — fine for prefetchQuery
  // (which swallows the rejection) but fatal for an awaited fetchQuery. The
  // client's own useInterview() still fetches this normally on mount.
  let interview: Interview | undefined
  try {
    interview = (await getInterview(id, requestOptions)) as Interview
  } catch {
    interview = undefined
  }

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
      queryKey: queryKeys.applicants.detail(application.user_nuid),
      queryFn: () => getApplicant(application.user_nuid, requestOptions),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.interviewAssignments.detail(id),
      queryFn: async () => {
        try {
          return await getInterviewAssignment(id, requestOptions)
        } catch {
          return null
        }
      },
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.interviewReviewAssignments.list(id),
      queryFn: () => listRecordingReviewerAssignments(id, requestOptions),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.interviewComments.list(id),
      queryFn: () => listInterviewComments(id, requestOptions),
    }),
    ...(interview
      ? [
          queryClient.prefetchQuery({
            queryKey: queryKeys.recordingReviews.list(interview.id),
            queryFn: () => listRecordingReviews(interview.id, requestOptions),
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
