import { notFound } from 'next/navigation'
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { PageContainer } from '@/components/PageContainer'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import { getServerIsChief } from '@/lib/auth/server-user'
import { pickDefaultCycleId } from '@/lib/queries/cycles'
import { queryKeys } from '@/lib/queries/keys'
import { fetchPreferenceLists } from '@/lib/queries/preference-lists'
import { prefetchCycles } from '@/lib/queries/server-prefetch'
import { PreferenceListsPageClient } from './components/PreferenceListsPageClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

async function currentReviewer(): Promise<{ isChief: boolean } | null> {
  try {
    return {
      isChief: await getServerIsChief(),
    }
  } catch {
    return null
  }
}

export default async function PreferenceListsPage({
  searchParams,
}: {
  searchParams: Promise<{ cycle?: string }>
}) {
  const queryClient = new QueryClient()
  const requestOptions = await getServerRequestOptions()
  const [reviewer, cycles, { cycle }] = await Promise.all([
    currentReviewer(),
    prefetchCycles(queryClient, requestOptions),
    searchParams,
  ])
  if (!reviewer) notFound()

  // Same cycle the client lands on: the ?cycle param, else the default.
  const cycleId = cycle || pickDefaultCycleId(cycles)
  if (cycleId) {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.preferenceLists.list(cycleId),
      queryFn: () => fetchPreferenceLists(cycleId, requestOptions),
    })
  }

  return (
    <PageContainer>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <PreferenceListsPageClient isChief={reviewer.isChief} />
      </HydrationBoundary>
    </PageContainer>
  )
}
