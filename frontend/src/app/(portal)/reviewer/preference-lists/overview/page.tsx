import { notFound } from 'next/navigation'
import { PageContainer } from '@/components/PageContainer'
import { getCurrentUser } from '@/generated/users/users'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import { PreferenceListsOverviewClient } from './components/PreferenceListsOverviewClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

// Any reviewer. Leads compare their group's picks against the others here;
// the backend serves them every group's ranked entries but withholds
// personal lists and in-group comments, which this board never rendered.
async function isReviewer(): Promise<boolean> {
  try {
    await getCurrentUser(await getServerRequestOptions())
    return true
  } catch {
    return false
  }
}

export default async function PreferenceListsOverviewPage() {
  if (!(await isReviewer())) notFound()

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
