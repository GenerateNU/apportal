import { notFound } from 'next/navigation'
import { InterviewAssignmentPlanClient } from './components/InterviewAssignmentPlanClient'
import { getServerCurrentUser } from '@/lib/auth/server-user'

// Auth-gated and driven entirely by chief input (meeting days are typed in,
// not stored), so there is nothing worth prefetching or prerendering here.
export const dynamic = 'force-dynamic'

// Chief/admin only. The sidebar hides this link from leads, but that alone
// leaves the route reachable by URL, so the check is repeated here on the
// server. The backend is still the actual boundary — every
// interview-assignment-plan endpoint calls requireChief — this just avoids
// rendering a page whose every request would 403.
export default async function InterviewAssignmentPlanPage() {
  if (!(await isChief())) notFound()
  return <InterviewAssignmentPlanClient />
}

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
