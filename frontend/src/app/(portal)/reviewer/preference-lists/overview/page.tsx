import { notFound } from 'next/navigation'
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { PageContainer } from '@/components/PageContainer'
import { listPreferenceListDetails } from '@/generated/preference-lists/preference-lists'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import type { PreferenceListDetail } from '@/lib/api/types'
import { getServerCurrentUser } from '@/lib/auth/server-user'
import { pickDefaultCycleId } from '@/lib/queries/cycles'
import { queryKeys } from '@/lib/queries/keys'
import {
  prefetchCycles,
  prefetchUsersByRole,
} from '@/lib/queries/server-prefetch'
import { PreferenceListsOverviewClient } from './components/PreferenceListsOverviewClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

// Any reviewer. Leads compare their group's picks against the others here;
// the backend serves them every group's ranked entries but withholds
// personal lists and in-group comments, which this board never rendered.
async function isReviewer(): Promise<boolean> {
  try {
    await getServerCurrentUser()
    return true
  } catch {
    return false
  }
}

export default async function PreferenceListsOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ cycle?: string }>
}) {
  const queryClient = new QueryClient()
  const requestOptions = await getServerRequestOptions()
  const [ok, cycles, { cycle }] = await Promise.all([
    isReviewer(),
    prefetchCycles(queryClient, requestOptions),
    searchParams,
    prefetchUsersByRole(queryClient, 'lead', requestOptions),
    prefetchUsersByRole(queryClient, 'chief', requestOptions),
  ])
  if (!ok) notFound()

  const cycleId = cycle || pickDefaultCycleId(cycles)
  if (cycleId) {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.preferenceLists.allDetails(cycleId),
      queryFn: async () =>
        ((await listPreferenceListDetails(
          { cycle_id: cycleId },
          requestOptions
        )) ?? []) as PreferenceListDetail[],
    })
  }

  return (
    <PageContainer>
      <div>
        <h1 className="text-text-default text-2xl font-semibold">
          Compare preference list groups
        </h1>
        <p className="text-text-muted mt-1 text-sm">
          Every group&apos;s ranked list for a cycle and role, side by side.
        </p>
      </div>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <PreferenceListsOverviewClient />
      </HydrationBoundary>
    </PageContainer>
  )
}
