import { notFound } from 'next/navigation'
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { getPreferenceList } from '@/generated/preference-lists/preference-lists'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import type { PreferenceListDetail } from '@/lib/api/types'
import { getServerIsChief } from '@/lib/auth/server-user'
import { queryKeys } from '@/lib/queries/keys'
import { prefetchUsersByRole } from '@/lib/queries/server-prefetch'
import { LeadPreferenceListClient } from './components/LeadPreferenceListClient'
import { ChiefTeamClient } from './components/ChiefTeamClient'

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

export default async function PreferenceListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const queryClient = new QueryClient()
  const requestOptions = await getServerRequestOptions()

  // The rest of the page (applications, answers, deadlines) keys off this
  // list's contents, so it loads client-side once the list is in hand.
  const [reviewer] = await Promise.all([
    currentReviewer(),
    queryClient.prefetchQuery({
      queryKey: queryKeys.preferenceLists.detail(id),
      queryFn: () =>
        getPreferenceList(id, requestOptions) as Promise<PreferenceListDetail>,
    }),
    prefetchUsersByRole(queryClient, 'lead', requestOptions),
    prefetchUsersByRole(queryClient, 'chief', requestOptions),
  ])
  if (!reviewer) notFound()

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {reviewer.isChief ? (
        <ChiefTeamClient id={id} />
      ) : (
        <LeadPreferenceListClient id={id} />
      )}
    </HydrationBoundary>
  )
}
