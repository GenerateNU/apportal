import Sidebar from '@/components/nav/Sidebar'
import { mockUser } from '@/lib/mock-user'
import { getRoles } from '@/types/roles'

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // TODO: replace mockUser with session user from auth
  const roles = getRoles(mockUser)

  return (
    <div className="flex h-screen">
      <Sidebar roles={roles} nuid={mockUser.nuid} />
      <main className="flex flex-1 flex-col overflow-y-auto bg-gray-50">
        {children}
      </main>
    </div>
  )
}
