import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { PageContainer } from '@/components/PageContainer'
import { getDraftBoard, listDraftedApplications } from '@/generated/draft/draft'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import type { DraftBoard } from '@/lib/api/types'
import { pickDefaultCycleId } from '@/lib/queries/cycles'
import { queryKeys } from '@/lib/queries/keys'
import { fetchPreferenceLists } from '@/lib/queries/preference-lists'
import { prefetchCycles } from '@/lib/queries/server-prefetch'
import { ROLE_COLUMNS } from '@/lib/roles'
import { DraftClient } from './components/DraftClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

export default async function DraftPage() {
  const queryClient = new QueryClient()
  const requestOptions = await getServerRequestOptions()

  const cycles = await prefetchCycles(queryClient, requestOptions)
  const cycleId = pickDefaultCycleId(cycles)
  if (cycleId) {
    const role = ROLE_COLUMNS[0]
    // An unopened board 404s; that isn't dehydrated, so the client fetches it
    // and lands on the setup screen as before.
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.drafts.board(cycleId, role),
        queryFn: () =>
          getDraftBoard(
            cycleId,
            { role },
            requestOptions
          ) as Promise<DraftBoard>,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.preferenceLists.list(cycleId),
        queryFn: () => fetchPreferenceLists(cycleId, requestOptions),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.drafts.drafted(cycleId),
        queryFn: async () =>
          ((await listDraftedApplications(cycleId, requestOptions)) ??
            {}) as Record<string, string>,
      }),
    ])
  }

  return (
    <PageContainer>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <DraftClient />
      </HydrationBoundary>
    </PageContainer>
  )
}
