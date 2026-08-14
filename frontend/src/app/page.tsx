'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { HelpContact } from '@/components/HelpContact'
import { Button } from '@/components/ui/button'
import { APIError } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/auth-context'
import { useCurrentUser } from '@/lib/queries/users'
import { defaultDashboard, getRoles } from '@/types/roles'

// The "portal" entry point: sends each user to the dashboard for their role
// rather than a fixed page, so "Back to portal" and "/" land correctly.
export default function RootPage() {
  const router = useRouter()
  const { signOut } = useAuth()
  const { data: user, isLoading, isError, error, refetch } = useCurrentUser()

  // The browser's Supabase client can hang onto a session whose access token
  // the backend no longer accepts (a stale refresh that silently kept the
  // old token, a revoked session, clock skew). That's a 401 from /me, not a
  // network/backend outage — clear it and send the user to /login instead of
  // stranding them on the "couldn't verify" retry screen with a dead cookie
  // that will just 401 again on every retry.
  const isUnauthenticated = error instanceof APIError && error.status === 401

  useEffect(() => {
    if (isLoading) return
    if (isUnauthenticated) {
      void signOut().then(() => router.replace('/login'))
      return
    }
    // A failed identity check (backend down, network error) is not the same
    // as "not signed in" — don't silently bounce those to /login.
    if (isError) return
    router.replace(user ? defaultDashboard(getRoles(user)) : '/login')
  }, [user, isLoading, isError, isUnauthenticated, signOut, router])

  if (isError && !isUnauthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 px-4">
        <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-lg border border-gray-100 bg-white p-8 text-center shadow-sm">
          <h1 className="text-text-default text-lg font-semibold">
            Couldn&apos;t verify your sign-in
          </h1>
          <p className="text-text-muted text-sm">
            We couldn&apos;t reach the server to check your sign-in status. This
            is usually temporary.
          </p>
          <Button onClick={() => refetch()}>Try again</Button>
        </div>
        <HelpContact className="max-w-sm" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <div className="text-text-muted flex items-center gap-2 text-sm">
        <Loader2 className="animate-spin" size={16} />
        Loading…
      </div>
      <HelpContact className="max-w-sm" />
    </div>
  )
}
