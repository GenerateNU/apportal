import { notFound } from 'next/navigation'
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import { FormBuilderClient } from './components/FormBuilderClient'
import { prefetchFormBuilder } from './lib/prefetch'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

export default async function FormBuilderPage({
  params,
}: {
  params: Promise<{ cycleId: string; role: string }>
}) {
  const { cycleId, role: roleId } = await params
  const queryClient = new QueryClient()
  const loaded = await prefetchFormBuilder(
    queryClient,
    cycleId,
    roleId,
    await getServerRequestOptions()
  )
  // The [role] segment is a role ID, and must be one of the cycle's.
  if (!loaded) notFound()

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <FormBuilderClient
        cycleId={cycleId}
        cycleName={loaded.cycle.name}
        role={roleId}
      />
    </HydrationBoundary>
  )
}
