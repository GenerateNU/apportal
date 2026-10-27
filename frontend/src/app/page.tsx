import { redirect } from 'next/navigation'
import type { User } from '@/lib/api/types'
import { getServerCurrentUser } from '@/lib/auth/server-user'
import { defaultDashboard, getRoles } from '@/types/roles'
import { RootFallback } from './RootFallback'

// The "portal" entry point: sends each user to the dashboard for their role
// rather than a fixed page, so "Back to portal" and "/" land correctly.
export default async function RootPage() {
  let user: User
  try {
    user = await getServerCurrentUser()
  } catch {
    // A stale session can't be cleared from a server component, and /login
    // would bounce it straight back here — let the client sign out instead.
    return <RootFallback />
  }
  redirect(defaultDashboard(getRoles(user)))
}
