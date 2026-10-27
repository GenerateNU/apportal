import { notFound } from 'next/navigation'
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { PageContainer } from '@/components/PageContainer'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import { getServerCurrentUser } from '@/lib/auth/server-user'
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
    const user = await getServerCurrentUser()
    return {
      isChief: (user.roles ?? []).some(
        (role) => role === 'chief' || role === 'admin'
      ),
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
      <div>
        <h1 className="text-text-default text-2xl font-semibold">
          Preference lists
        </h1>
        <p className="text-text-muted mt-1 text-sm">
          Collaborative, ranked lists of applicants leads want for a cycle and
          role. Create one and invite whichever other leads you want to work on
          it with.
        </p>
      </div>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <PreferenceListsPageClient isChief={reviewer.isChief} />
      </HydrationBoundary>
    </PageContainer>
  )
}
