import { notFound } from 'next/navigation'
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { listCycleChallenges } from '@/generated/code-challenges/code-challenges'
import { getCycle } from '@/generated/cycles/cycles'
import { listCycleQuestions } from '@/generated/questions/questions'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import { queryKeys } from '@/lib/queries/keys'
import { prefetchRoles } from '@/lib/queries/server-prefetch'
import { NewApplicationForm } from './components/NewApplicationForm'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

export default async function NewApplicationPage({
  searchParams,
}: {
  searchParams: Promise<{ cycle?: string; role?: string }>
}) {
  const { cycle: cycleId, role } = await searchParams
  if (!cycleId || !role) notFound()

  const queryClient = new QueryClient()
  const requestOptions = await getServerRequestOptions()

  const [cycle, roles] = await Promise.all([
    queryClient.fetchQuery({
      queryKey: queryKeys.cycles.detail(cycleId),
      queryFn: () => getCycle(cycleId, requestOptions),
    }),
    prefetchRoles(queryClient, requestOptions),
    queryClient.prefetchQuery({
      queryKey: queryKeys.questions.list(cycleId, role),
      queryFn: () =>
        listCycleQuestions(cycleId, { role_id: role }, requestOptions),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.challenges.list(cycleId, role),
      queryFn: () =>
        listCycleChallenges(cycleId, { role_id: role }, requestOptions),
    }),
  ])
  // The role must be one this cycle recruits for.
  if (!roles.some((r) => r.id === role && r.cycle_id === cycleId)) {
    notFound()
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <NewApplicationForm
        cycleId={cycleId}
        cycleName={cycle.name}
        role={role}
      />
    </HydrationBoundary>
  )
}
