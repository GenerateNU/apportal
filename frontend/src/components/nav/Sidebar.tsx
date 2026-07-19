'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  UserPlus,
  FileText,
  RefreshCw,
  Settings,
  LogOut,
} from 'lucide-react'
import NavItem from './NavItem'
import { Avatar } from '@/components/ui/avatar'
import { useAuth } from '@/lib/auth/auth-context'
import type { Role } from '@/types/roles'

interface SidebarProps {
  roles: Role[]
  fullName?: string
}

type NavSection = {
  label: string
  items: { href: string; label: string; icon: typeof FileText }[]
}

const sectionsByRole: Record<Role, NavSection> = {
  applicant: {
    label: 'Applications',
    items: [
      {
        href: '/applicant/applications',
        label: 'My Applications',
        icon: FileText,
      },
    ],
  },
  reviewer: {
    label: 'Review',
    items: [
      {
        href: '/reviewer/dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
      },
      { href: '/reviewer/applicants', label: 'Applicants', icon: Users },
      { href: '/reviewer/applications', label: 'Review queue', icon: FileText },
      {
        href: '/reviewer/assignments',
        label: 'Assign reviewers',
        icon: UserPlus,
      },
    ],
  },
  admin: {
    label: 'Admin',
    items: [
      { href: '/admin/cycles', label: 'Cycles', icon: RefreshCw },
      { href: '/admin/applications', label: 'Applications', icon: FileText },
      { href: '/admin/roles', label: 'Roles', icon: Settings },
    ],
  },
}

// Display order: reviewer sections before applicant, admin last
const roleOrder: Role[] = ['reviewer', 'applicant', 'admin']

function SidebarUser({ fullName }: { fullName: string }) {
  const router = useRouter()
  const { signOut } = useAuth()

  async function handleSignOut() {
    await signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="border-t border-gray-100 px-4 py-3">
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <Avatar name={fullName} size="sm" />
          <span className="text-text-secondary text-sm font-medium">
            {fullName}
          </span>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          aria-label="Sign out"
          className="text-text-subtle hover:text-text-default rounded-md p-1.5 hover:bg-gray-100"
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  )
}

export default function Sidebar({ roles, fullName }: SidebarProps) {
  const sections = roleOrder
    .filter((role) => roles.includes(role))
    .map((role) => sectionsByRole[role])

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-gray-100 bg-white">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-gray-100 px-5">
        <Image
          src="/GenerateNU Logo.png"
          alt="GenerateNU"
          width={28}
          height={28}
          className="object-contain"
        />
        <span className="text-brand-blue text-xl font-semibold">Generate</span>
      </div>

      {/* Nav sections */}
      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="text-text-subtle mb-1 px-3 text-xs font-medium tracking-wider uppercase">
              {section.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => (
                <NavItem key={item.href} {...item} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      {fullName && <SidebarUser fullName={fullName} />}
    </aside>
  )
}
