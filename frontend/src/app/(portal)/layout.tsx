'use client'

import { useState } from 'react'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { MobileNavSheet } from '@/components/nav/MobileNavSheet'
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
  const isChief = !!currentUser?.roles.some(
    (role) => role === 'chief' || role === 'admin'
  )

  const pathname = usePathname()
  const [navOpen, setNavOpen] = useState(false)

  const [prevPathname, setPrevPathname] = useState(pathname)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    setNavOpen(false)
  }

  return (
    <div className="flex h-screen flex-col lg:flex-row">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-100 px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          aria-label="Open menu"
          className="text-text-subtle hover:text-text-default -ml-1.5 rounded-md p-1.5 hover:bg-gray-100"
        >
          <Menu size={20} />
        </button>
        <Image
          src="/GenerateNU Logo.png"
          alt="GenerateNU"
          width={22}
          height={22}
          className="object-contain"
        />
        <span className="text-brand-blue text-lg font-semibold">
          Generate
        </span>
      </header>

      <div className="hidden lg:block">
        <Sidebar
          roles={roles}
          fullName={currentUser?.full_name}
          isChief={isChief}
        />
      </div>

      <MobileNavSheet open={navOpen} onOpenChange={setNavOpen}>
        <Sidebar
          roles={roles}
          fullName={currentUser?.full_name}
          isChief={isChief}
        />
      </MobileNavSheet>

      <main className="flex flex-1 flex-col overflow-y-auto bg-gray-50">
        {children}
      </main>
    </div>
  )
}
