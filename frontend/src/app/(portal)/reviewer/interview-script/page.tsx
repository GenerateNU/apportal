import { notFound } from 'next/navigation'
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { PageContainer } from '@/components/PageContainer'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import { prefetchInterviewScript } from '@/lib/queries/server-prefetch'
import { InterviewScriptPageClient } from './components/InterviewScriptPageClient'
import { getServerCurrentUser } from '@/lib/auth/server-user'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

// Any reviewer can view; only chiefs get the edit link. The backend is still
// the actual boundary (update-interview-script calls requireChief) — this
// just decides whether to show the link at all.
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
    <PageContainer>
      <div>
        <h1 className="text-text-default text-2xl font-semibold">
          Interview script
        </h1>
        <p className="text-text-muted mt-1 text-sm">
          The intro speech, question bank, and challenge follow-ups to use while
          conducting an interview — one script per cycle and role.
        </p>
      </div>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <InterviewScriptPageClient isChief={reviewer.isChief} />
      </HydrationBoundary>
    </PageContainer>
  )
}
