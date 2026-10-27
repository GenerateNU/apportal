import { notFound } from 'next/navigation'
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { getApplication } from '@/generated/applications/applications'
import {
  listDecisionTemplates,
  listDecisions,
} from '@/generated/decisions/decisions'
import { listCycleReviewQuestions } from '@/generated/review-questions/review-questions'
import type {
  Application,
  DecisionRow,
  DecisionTemplate,
  ReviewQuestion,
  Role,
} from '@/lib/api/types'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import { fetchDecisionContext } from '@/lib/queries/decisions'
import { queryKeys } from '@/lib/queries/keys'
import { prefetchCycles } from '@/lib/queries/server-prefetch'
import { DecisionDraftClient } from './components/DecisionDraftClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

// The cycle and role come from the application so the client can ask for the
// right letter and review questions. Everything else it needs (the decision
// row, the queue it sits in) comes from the cycle's decisions list.
export default async function DecisionDraftPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const queryClient = new QueryClient()
  const requestOptions = await getServerRequestOptions()

  // The context doesn't depend on the application, so it starts alongside it.
  const contextPrefetch = queryClient.prefetchQuery({
    queryKey: queryKeys.decisions.context([id]),
    queryFn: () => fetchDecisionContext([id], requestOptions),
  })

  let application: Application
  try {
    application = (await getApplication(id, requestOptions)) as Application
  } catch {
    notFound()
  }
  const cycleId = application.cycle_id
  const role = application.role as Role

  await Promise.all([
    contextPrefetch,
    prefetchCycles(queryClient, requestOptions),
    queryClient.prefetchQuery({
      queryKey: queryKeys.decisions.list(cycleId),
      queryFn: async () =>
        ((await listDecisions(cycleId, undefined, requestOptions)) ??
          []) as DecisionRow[],
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.decisions.templates(cycleId, role),
      queryFn: async () =>
        ((await listDecisionTemplates(cycleId, { role }, requestOptions)) ??
          []) as DecisionTemplate[],
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.reviewQuestions.list(cycleId, role),
      queryFn: async () =>
        ((await listCycleReviewQuestions(cycleId, { role }, requestOptions)) ??
          []) as ReviewQuestion[],
    }),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DecisionDraftClient applicationId={id} cycleId={cycleId} role={role} />
    </HydrationBoundary>
  )
}
