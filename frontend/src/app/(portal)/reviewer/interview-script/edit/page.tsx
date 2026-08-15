import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/generated/users/users'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import { InterviewScriptEditClient } from './components/InterviewScriptEditClient'

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
    const user = await getCurrentUser(await getServerRequestOptions())
    return (user.roles ?? []).some(
      (role) => role === 'chief' || role === 'admin'
    )
  } catch {
    return false
  }
}

export default async function InterviewScriptEditPage() {
  if (!(await isChief())) notFound()

  return <InterviewScriptEditClient />
}
