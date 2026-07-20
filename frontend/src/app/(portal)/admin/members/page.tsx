import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { listUsers } from '@/generated/users/users'
import { queryKeys } from '@/lib/queries/keys'
import { REVIEWER_ACTOR } from '@/lib/stub-actor'
import { MembersClient } from './components/MembersClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

export default async function MembersPage() {
  const queryClient = new QueryClient()

  await queryClient.prefetchQuery({
    queryKey: queryKeys.users.list(undefined),
    queryFn: async () => (await listUsers({}, { actor: REVIEWER_ACTOR })) ?? [],
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <MembersClient />
    </HydrationBoundary>
  )
}
