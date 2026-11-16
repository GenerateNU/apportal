import { notFound } from 'next/navigation'
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import { fetchBranches } from '@/lib/queries/branches'
import { queryKeys } from '@/lib/queries/keys'
import { FormBuilderClient } from '../../../../../../applications/[cycleId]/[role]/builder/components/FormBuilderClient'
import { prefetchFormBuilder } from '../../../../../../applications/[cycleId]/[role]/builder/lib/prefetch'
import { branchCrumbs } from '../../../../../lib/breadcrumbs'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

// The form builder, reached from a branch's cycle so navigation stays under
// Branches.
export default async function BranchApplicationFormPage({
  params,
}: {
  params: Promise<{ id: string; cycleId: string; roleId: string }>
}) {
  const { id, cycleId, roleId } = await params
  const queryClient = new QueryClient()
  const requestOptions = await getServerRequestOptions()

  const [branches, loaded] = await Promise.all([
    queryClient.fetchQuery({
      queryKey: queryKeys.branches.list(),
      queryFn: () => fetchBranches(requestOptions),
    }),
    prefetchFormBuilder(queryClient, cycleId, roleId, requestOptions),
  ])
  const branch = branches.find((b) => b.id === id)
  if (!branch || !loaded || loaded.cycle.branch_id !== id) notFound()

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <FormBuilderClient
        cycleId={cycleId}
        cycleName={loaded.cycle.name}
        role={roleId}
        back={
          <Breadcrumbs
            items={branchCrumbs({
              branchId: id,
              branch,
              cycle: loaded.cycle,
              showCycle: true,
              formLabel: loaded.role.name,
            })}
          />
        }
      />
    </HydrationBoundary>
  )
}
