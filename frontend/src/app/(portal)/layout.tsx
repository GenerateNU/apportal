'use client'

import Sidebar from '@/components/nav/Sidebar'
import { useCurrentUser } from '@/lib/queries/users'
import { getRoles } from '@/types/roles'

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: currentUser } = useCurrentUser()
  const roles = currentUser ? getRoles(currentUser) : []

  return (
    <div className="flex h-screen">
      <Sidebar roles={roles} fullName={currentUser?.full_name} />
      <main className="flex flex-1 flex-col overflow-y-auto bg-gray-50">
        {children}
      </main>
    </div>
  )
}
