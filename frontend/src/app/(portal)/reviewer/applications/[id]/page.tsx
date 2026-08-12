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
import type { Application, Role } from '@/lib/api/types'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import { queryKeys } from '@/lib/queries/keys'
import { ApplicationDetailClient } from './components/ApplicationDetailClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

export default async function ApplicationPage({
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
      queryKey: queryKeys.applicants.detail(application.user_nuid),
      queryFn: () => getApplicant(application.user_nuid, requestOptions),
    }),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ApplicationDetailClient
        applicationId={id}
        cycleId={application.cycle_id}
        role={role}
        applicantNuid={application.user_nuid}
      />
    </HydrationBoundary>
  )
}
