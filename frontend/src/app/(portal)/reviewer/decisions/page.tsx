import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/generated/users/users'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import { DecisionQueueClient } from './components/DecisionQueueClient'
import { DecisionsClient } from './components/DecisionsClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then).
export const dynamic = 'force-dynamic'

// Leads and chiefs get genuinely different screens here, not one screen with
// pieces hidden: a lead's job is writing feedback for the applicants they
// interviewed, a chief's is compiling and sending the whole cycle. The backend
// is still the boundary — list-decisions scopes a lead to their own
// interviewees, and the template routes call requireChief.
async function currentReviewer() {
  try {
    const user = await getCurrentUser(await getServerRequestOptions())
    const roles = user.roles ?? []
    if (!roles.some((r) => r === 'lead' || r === 'chief' || r === 'admin')) {
      return null
    }
    return {
      nuid: user.nuid,
      isChief: roles.some((r) => r === 'chief' || r === 'admin'),
    }
  } catch {
    return null
  }
}

export default async function DecisionsPage() {
  const reviewer = await currentReviewer()
  if (!reviewer) notFound()

  if (!reviewer.isChief) return <DecisionQueueClient />
  return <DecisionsClient currentNUID={reviewer.nuid} />
}
