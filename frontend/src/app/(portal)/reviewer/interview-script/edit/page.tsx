import { notFound } from 'next/navigation'
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import { prefetchInterviewScript } from '@/lib/queries/server-prefetch'
import { InterviewScriptEditClient } from './components/InterviewScriptEditClient'
import { getServerCurrentUser } from '@/lib/auth/server-user'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

// Chief/admin only. The sidebar hides this link from non-chiefs, but that
// alone leaves the route reachable by URL, so the check is repeated here on
// the server. The backend is still the actual boundary — update-interview-script
// calls requireChief — this just avoids rendering a page whose only action
// would 403.
async function isChief(): Promise<boolean> {
  try {
    const user = await getServerCurrentUser()
    return (user.roles ?? []).some(
      (role) => role === 'chief' || role === 'admin'
    )
  } catch {
    return false
  }
}

export default async function InterviewScriptEditPage({
  searchParams,
}: {
  searchParams: Promise<{ cycle?: string; role?: string }>
}) {
  const queryClient = new QueryClient()
  const requestOptions = await getServerRequestOptions()
  const [chief] = await Promise.all([
    isChief(),
    searchParams.then((sp) =>
      prefetchInterviewScript(queryClient, sp, requestOptions)
    ),
  ])
  if (!chief) notFound()

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <InterviewScriptEditClient />
    </HydrationBoundary>
  )
}
