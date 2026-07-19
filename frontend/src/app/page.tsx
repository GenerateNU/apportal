'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useCurrentUser } from '@/lib/queries/users'
import { defaultDashboard, getRoles } from '@/types/roles'

// The "portal" entry point: sends each user to the dashboard for their role
// rather than a fixed page, so "Back to portal" and "/" land correctly.
export default function RootPage() {
  const router = useRouter()
  const { data: user, isLoading } = useCurrentUser()

  useEffect(() => {
    if (isLoading) return
    router.replace(user ? defaultDashboard(getRoles(user)) : '/login')
  }, [user, isLoading, router])

  return (
    <div className="text-text-muted flex min-h-screen items-center justify-center gap-2 text-sm">
      <Loader2 className="animate-spin" size={16} />
      Loading…
    </div>
  )
}
