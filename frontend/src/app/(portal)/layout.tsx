'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { MobileNavSheet } from '@/components/nav/MobileNavSheet'
import Sidebar from '@/components/nav/Sidebar'
import { useCurrentUser } from '@/lib/queries/users'
import { getRoles } from '@/types/roles'

// Desktop-only — the mobile nav is a slide-out drawer, not a persistent rail,
// so there's no reason to collapse it further. Persisted across visits like
// the other per-user layout preferences in this app.
const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed'

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

  // Restored once on mount — done in an effect (rather than a useState
  // initializer) so the server-rendered markup and the first client render
  // match before localStorage is consulted.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  useEffect(() => {
    if (localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSidebarCollapsed(true)
    }
  }, [])
  function toggleSidebarCollapsed() {
    setSidebarCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next))
      return next
    })
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden lg:flex-row lg:bg-gray-50 lg:pt-4 lg:pl-4">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-100 px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          aria-label="Open menu"
          className="text-text-subtle hover:text-text-default -ml-2 rounded-md p-2 hover:bg-gray-100"
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
        <span className="text-brand-blue text-lg font-semibold">Generate</span>
      </header>

      <div className="hidden lg:block">
        <Sidebar
          roles={roles}
          fullName={currentUser?.full_name}
          isChief={isChief}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebarCollapsed}
        />
      </div>

      <MobileNavSheet open={navOpen} onOpenChange={setNavOpen}>
        <Sidebar
          roles={roles}
          fullName={currentUser?.full_name}
          isChief={isChief}
        />
      </MobileNavSheet>

      <main className="flex flex-1 flex-col overflow-hidden border border-gray-200 bg-white lg:rounded-tl-[25]">
        {/* overscroll-none: without it, scrolling past the end of a long page
          chains to the viewport and rubber-bands the whole shell. */}
        <div className="flex flex-1 flex-col overflow-y-auto overscroll-none">
          {children}
        </div>
      </main>
    </div>
  )
}
