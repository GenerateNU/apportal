import { notFound } from 'next/navigation'
import { PageContainer } from '@/components/PageContainer'
import { PreferenceListsPageClient } from './components/PreferenceListsPageClient'
import { getServerCurrentUser } from '@/lib/auth/server-user'

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

export default async function PreferenceListsPage() {
  const reviewer = await currentReviewer()
  if (!reviewer) notFound()

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
      <PreferenceListsPageClient isChief={reviewer.isChief} />
    </PageContainer>
  )
}
