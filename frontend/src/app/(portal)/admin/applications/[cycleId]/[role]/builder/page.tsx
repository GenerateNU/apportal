import { notFound } from 'next/navigation'
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { getApplicationTemplate } from '@/generated/application-templates/application-templates'
import { getCycle } from '@/generated/cycles/cycles'
import { listCycleQuestions } from '@/generated/questions/questions'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import { queryKeys } from '@/lib/queries/keys'
import { prefetchRoles } from '@/lib/queries/server-prefetch'
import { FormBuilderClient } from './components/FormBuilderClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

export default async function FormBuilderPage({
  params,
}: {
  params: Promise<{ cycleId: string; role: string }>
}) {
  const { cycleId, role: validRole } = await params
  const queryClient = new QueryClient()
  const requestOptions = await getServerRequestOptions()

  const [cycle, roles] = await Promise.all([
    queryClient.fetchQuery({
      queryKey: queryKeys.cycles.detail(cycleId),
      queryFn: () => getCycle(cycleId, requestOptions),
    }),
    prefetchRoles(queryClient, requestOptions),
  ])
  // The [role] segment is a role ID, and must be one of the cycle's.
  if (!roles.some((r) => r.id === validRole && r.cycle_id === cycleId)) {
    notFound()
  }

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.questions.list(cycleId, validRole),
      queryFn: () =>
        listCycleQuestions(cycleId, { role_id: validRole }, requestOptions),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.applicationTemplates.detail(cycleId, validRole),
      queryFn: () =>
        getApplicationTemplate(cycleId, { role_id: validRole }, requestOptions),
    }),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <FormBuilderClient
        cycleId={cycleId}
        cycleName={cycle.name}
        role={validRole}
      />
    </HydrationBoundary>
  )
}
