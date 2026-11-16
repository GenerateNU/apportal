import { notFound } from 'next/navigation'
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { listCycleApplicationTemplates } from '@/generated/application-templates/application-templates'
import { cycleTemplateSummary } from '@/generated/cycles/cycles'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import { fetchBranches } from '@/lib/queries/branches'
import { fetchCycleStaff } from '@/lib/queries/cycle-staff'
import { fetchCycles } from '@/lib/queries/cycles'
import { queryKeys } from '@/lib/queries/keys'
import { prefetchRoles } from '@/lib/queries/server-prefetch'
import { CycleDetailClient } from './components/CycleDetailClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

export default async function CycleDetailPage({
  params,
}: {
  params: Promise<{ id: string; cycleId: string }>
}) {
  const { id, cycleId } = await params
  const queryClient = new QueryClient()
  const requestOptions = await getServerRequestOptions()

  const [branches, cycles] = await Promise.all([
    queryClient.fetchQuery({
      queryKey: queryKeys.branches.list(),
      queryFn: () => fetchBranches(requestOptions),
    }),
    queryClient.fetchQuery({
      queryKey: queryKeys.cycles.list({ branch_id: id }),
      queryFn: () => fetchCycles({ branch_id: id }, requestOptions),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.applicationTemplates.cycleList(cycleId),
      queryFn: async () =>
        (await listCycleApplicationTemplates(cycleId, requestOptions)) ?? [],
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.cycles.templateSummary(cycleId),
      queryFn: async () =>
        (await cycleTemplateSummary(cycleId, requestOptions)) ?? [],
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.cycleStaff.list(cycleId),
      queryFn: () => fetchCycleStaff(cycleId, requestOptions),
    }),
    prefetchRoles(queryClient, requestOptions),
  ])
  if (
    !branches.some((b) => b.id === id) ||
    !cycles.some((c) => c.id === cycleId)
  ) {
    notFound()
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CycleDetailClient branchId={id} cycleId={cycleId} />
    </HydrationBoundary>
  )
}
