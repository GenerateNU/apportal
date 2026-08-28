import { notFound } from 'next/navigation'
import { PageContainer } from '@/components/PageContainer'
import { getCurrentUser } from '@/generated/users/users'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import { PreferenceListsOverviewClient } from './components/PreferenceListsOverviewClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

// Chief/admin only. Unlike the index page (visible to any reviewer, with
// isChief only toggling deadline editors), this page's whole point is
// cross-group visibility a lead shouldn't have, so it 404s outright — the
// backend's list-preference-list-details route is chief-only too.
async function isChief(): Promise<boolean> {
  try {
    const user = await getCurrentUser(await getServerRequestOptions())
    return (user.roles ?? []).some(
      (role) => role === 'chief' || role === 'admin'
    )
  } catch {
    return false
  }
}

export default async function PreferenceListsOverviewPage() {
  if (!(await isChief())) notFound()

  return (
    <PageContainer>
      <div>
        <h1 className="text-text-default text-2xl font-semibold">
          Compare preference list groups
        </h1>
        <p className="text-text-muted mt-1 text-sm">
          Every group&apos;s ranked list for a cycle and role, side by side.
        </p>
      </div>
      <PreferenceListsOverviewClient />
    </PageContainer>
  )
}
