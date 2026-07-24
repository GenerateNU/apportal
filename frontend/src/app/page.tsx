'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { HelpContact } from '@/components/HelpContact'
import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/lib/queries/users'
import { defaultDashboard, getRoles } from '@/types/roles'

// The "portal" entry point: sends each user to the dashboard for their role
// rather than a fixed page, so "Back to portal" and "/" land correctly.
export default function RootPage() {
  const router = useRouter()
  const { data: user, isLoading, isError, refetch } = useCurrentUser()

  useEffect(() => {
    // A failed identity check (backend down, network error) is not the same
    // as "not signed in" — don't silently bounce those to /login.
    if (isLoading || isError) return
    router.replace(user ? defaultDashboard(getRoles(user)) : '/login')
  }, [user, isLoading, isError, router])

  if (isError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 px-4">
        <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-lg border border-gray-100 bg-white p-8 text-center shadow-sm">
          <h1 className="text-text-default text-lg font-semibold">
            Couldn&apos;t verify your sign-in
          </h1>
          <p className="text-text-muted text-sm">
            We couldn&apos;t reach the server to check your sign-in status.
            This is usually temporary.
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
