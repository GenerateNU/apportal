import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { listCycles } from '@/generated/cycles/cycles'
import { queryKeys } from '@/lib/queries/keys'
import { REVIEWER_ACTOR } from '@/lib/stub-actor'
import { CyclesClient } from './components/CyclesClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

export default async function CyclesPage() {
  const queryClient = new QueryClient()

  await queryClient.prefetchQuery({
    queryKey: queryKeys.cycles.list({}),
    queryFn: async () =>
      (await listCycles({}, { actor: REVIEWER_ACTOR })) ?? [],
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CyclesClient />
    </HydrationBoundary>
  )
}
