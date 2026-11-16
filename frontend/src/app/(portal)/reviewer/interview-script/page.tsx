import { notFound } from 'next/navigation'
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import { prefetchInterviewScript } from '@/lib/queries/server-prefetch'
import { InterviewScriptPageClient } from './components/InterviewScriptPageClient'
import { getServerIsChief } from '@/lib/auth/server-user'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

// Any reviewer can view; only chiefs get the edit link. The backend is still
// the actual boundary (update-interview-script calls requireChief) — this
// just decides whether to show the link at all.
async function currentReviewer(): Promise<{ isChief: boolean } | null> {
  try {
    return {
      isChief: await getServerIsChief(),
    }
  } catch {
    return null
  }
}

export default async function InterviewScriptPage({
  searchParams,
}: {
  searchParams: Promise<{ cycle?: string; role?: string }>
}) {
  const queryClient = new QueryClient()
  const requestOptions = await getServerRequestOptions()
  const [reviewer] = await Promise.all([
    currentReviewer(),
    searchParams.then((sp) =>
      prefetchInterviewScript(queryClient, sp, requestOptions)
    ),
  ])
  if (!reviewer) notFound()

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <InterviewScriptPageClient />
    </HydrationBoundary>
  )
}
