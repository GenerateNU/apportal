import { notFound } from 'next/navigation'
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { listAnswers } from '@/generated/answers/answers'
import { getApplication } from '@/generated/applications/applications'
import { listCodeSubmissions } from '@/generated/code-submissions/code-submissions'
import { listCycleChallenges } from '@/generated/code-challenges/code-challenges'
import { getCycle } from '@/generated/cycles/cycles'
import { listCycleQuestions } from '@/generated/questions/questions'
import type { Application, Role } from '@/lib/api/types'
import { queryKeys } from '@/lib/queries/keys'
import { APPLICANT_ACTOR } from '@/lib/stub-actor'
import { ApplicationView } from './components/ApplicationView'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

export default async function ApplicationDetailPage({
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
      queryFn: () => getApplication(id, { actor: APPLICANT_ACTOR }),
    })) as Application
  } catch {
    notFound()
  }

  const role = application.role as Role

  const [cycle] = await Promise.all([
    queryClient.fetchQuery({
      queryKey: queryKeys.cycles.detail(application.cycle_id),
      queryFn: () => getCycle(application.cycle_id, { actor: APPLICANT_ACTOR }),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.questions.list(application.cycle_id, role),
      queryFn: () =>
        listCycleQuestions(
          application.cycle_id,
          { role },
          { actor: APPLICANT_ACTOR }
        ),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.challenges.list(application.cycle_id, role),
      queryFn: () =>
        listCycleChallenges(
          application.cycle_id,
          { role },
          { actor: APPLICANT_ACTOR }
        ),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.answers.list(id),
      queryFn: () => listAnswers(id, { actor: APPLICANT_ACTOR }),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.submissions.detail(id),
      queryFn: () => listCodeSubmissions(id, { actor: APPLICANT_ACTOR }),
    }),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ApplicationView
        applicationId={id}
        cycleId={application.cycle_id}
        cycleName={cycle.name}
        role={role}
      />
    </HydrationBoundary>
  )
}
