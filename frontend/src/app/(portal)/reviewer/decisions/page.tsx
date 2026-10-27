import { notFound } from 'next/navigation'
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import {
  listDecisionTemplates,
  listDecisions,
} from '@/generated/decisions/decisions'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import type { DecisionRow, DecisionTemplate, Role } from '@/lib/api/types'
import { getServerCurrentUser } from '@/lib/auth/server-user'
import { defaultPipelineCycleId } from '@/lib/cycles'
import type { DecisionListParams } from '@/lib/queries/decisions'
import { queryKeys } from '@/lib/queries/keys'
import { prefetchCycles } from '@/lib/queries/server-prefetch'
import { DecisionQueueClient } from './components/DecisionQueueClient'
import { DecisionsClient } from './components/DecisionsClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

// Leads and chiefs get genuinely different screens here, not one screen with
// pieces hidden: a lead's job is writing feedback for the applicants they
// interviewed, a chief's is compiling and sending the whole cycle. The backend
// is still the boundary — list-decisions scopes a lead to their own
// interviewees, and the template routes call requireChief.
async function currentReviewer() {
  try {
    const user = await getServerCurrentUser()
    const roles = user.roles ?? []
    if (!roles.some((r) => r === 'lead' || r === 'chief' || r === 'admin')) {
      return null
    }
    return {
      nuid: user.nuid,
      isChief: roles.some((r) => r === 'chief' || r === 'admin'),
    }
  } catch {
    return null
  }
}

// The chief board mounts filtered to this role; the lead queue is unfiltered.
const CHIEF_DEFAULT_ROLE: Role = 'software_engineer'

export default async function DecisionsPage() {
  const queryClient = new QueryClient()
  const requestOptions = await getServerRequestOptions()
  const [reviewer, cycles] = await Promise.all([
    currentReviewer(),
    prefetchCycles(queryClient, requestOptions),
  ])
  if (!reviewer) notFound()

  const cycleId = defaultPipelineCycleId(cycles)
  if (cycleId) {
    const params: DecisionListParams | undefined = reviewer.isChief
      ? { role: CHIEF_DEFAULT_ROLE }
      : undefined
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.decisions.list(cycleId, params),
        queryFn: async () =>
          ((await listDecisions(cycleId, params, requestOptions)) ??
            []) as DecisionRow[],
      }),
      reviewer.isChief &&
        queryClient.prefetchQuery({
          queryKey: queryKeys.decisions.templates(cycleId, CHIEF_DEFAULT_ROLE),
          queryFn: async () =>
            ((await listDecisionTemplates(
              cycleId,
              { role: CHIEF_DEFAULT_ROLE },
              requestOptions
            )) ?? []) as DecisionTemplate[],
        }),
    ])
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {reviewer.isChief ? (
        <DecisionsClient currentNUID={reviewer.nuid} />
      ) : (
        <DecisionQueueClient />
      )}
    </HydrationBoundary>
  )
}
