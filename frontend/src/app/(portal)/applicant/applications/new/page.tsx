import { notFound } from 'next/navigation'
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { listCycleChallenges } from '@/generated/code-challenges/code-challenges'
import { getCycle } from '@/generated/cycles/cycles'
import { listCycleQuestions } from '@/generated/questions/questions'
import type { Role } from '@/lib/api/types'
import { queryKeys } from '@/lib/queries/keys'
import { NewApplicationForm } from './components/NewApplicationForm'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

const VALID_ROLES: Role[] = ['software_engineer', 'software_designer']

export default async function NewApplicationPage({
  searchParams,
}: {
  searchParams: Promise<{ cycle?: string; role?: string }>
}) {
  const { cycle: cycleId, role } = await searchParams
  if (!cycleId || !role || !VALID_ROLES.includes(role as Role)) {
    notFound()
  }
  const validRole = role as Role

  const queryClient = new QueryClient()

  const [cycle] = await Promise.all([
    queryClient.fetchQuery({
      queryKey: queryKeys.cycles.detail(cycleId),
      queryFn: () => getCycle(cycleId),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.questions.list(cycleId, validRole),
      queryFn: () => listCycleQuestions(cycleId, { role: validRole }),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.challenges.list(cycleId, validRole),
      queryFn: () => listCycleChallenges(cycleId, { role: validRole }),
    }),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <NewApplicationForm
        cycleId={cycleId}
        cycleName={cycle.name}
        role={validRole}
      />
    </HydrationBoundary>
  )
}
