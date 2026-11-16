'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { MobileNavSheet } from '@/components/nav/MobileNavSheet'
import Sidebar from '@/components/nav/Sidebar'
import { useStaffAccess } from '@/lib/queries/cycle-staff'
import { useCurrentUser } from '@/lib/queries/users'
import { SIDEBAR_COLLAPSED_COOKIE } from '@/lib/sidebar'
import { getRoles } from '@/types/roles'

export function PortalShell({
  initialSidebarCollapsed,
  children,
}: {
  initialSidebarCollapsed: boolean
  children: React.ReactNode
}) {
  const { data: currentUser } = useCurrentUser()
  const { isChief, isStaff } = useStaffAccess()
  const roles = currentUser ? getRoles(currentUser, isStaff) : []

  const pathname = usePathname()
  const [navOpen, setNavOpen] = useState(false)

  const [prevPathname, setPrevPathname] = useState(pathname)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    setNavOpen(false)
  }

  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    initialSidebarCollapsed
  )
  function toggleSidebarCollapsed() {
    setSidebarCollapsed((prev) => {
      const next = !prev
      document.cookie = `${SIDEBAR_COLLAPSED_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
      return next
    })
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        toggleSidebarCollapsed()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="flex h-dvh flex-col overflow-hidden lg:flex-row">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          aria-label="Open menu"
          className="text-ink/60 hover:text-ink -ml-2 p-2 hover:bg-gray-100"
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
        <span className="font-display text-ink text-base font-bold tracking-tight uppercase">
          Generate
        </span>
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

      <main className="flex flex-1 flex-col overflow-hidden border-gray-200 bg-white lg:border-l">
        {/* overscroll-none: without it, scrolling past the end of a long page
          chains to the viewport and rubber-bands the whole shell. */}
        <div className="flex flex-1 flex-col overflow-y-auto overscroll-none">
          {children}
        </div>
      </main>
    </div>
  )
}
