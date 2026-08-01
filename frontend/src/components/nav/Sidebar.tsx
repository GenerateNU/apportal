'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  Users,
  UserPlus,
  FileText,
  Calendar,
  ClipboardCheck,
  LogOut,
} from 'lucide-react'
import NavItem from './NavItem'
import { Avatar } from '@/components/ui/avatar'
import { useAuth } from '@/lib/auth/auth-context'
import type { Role } from '@/types/roles'

interface SidebarProps {
  roles: Role[]
  fullName?: string
  // Whether the user can act as a chief (holds the chief or admin role). Some
  // reviewer nav items are chief-only actions.
  isChief?: boolean
}

type NavItemConfig = {
  href: string
  label: string
  icon: typeof FileText
  chiefOnly?: boolean
}

type NavSection = {
  label: string
  items: NavItemConfig[]
}

const sectionsByRole: Record<Role, NavSection> = {
  applicant: {
    label: 'Applications',
    items: [
      {
        href: '/applicant/applications',
        label: 'Apply',
        icon: FileText,
      },
    ],
  },
  reviewer: {
    label: 'Review',
    items: [
      { href: '/reviewer/applications', label: 'Applications', icon: Users },
      { href: '/reviewer/my-reviews', label: 'Review Queue', icon: FileText },
      {
        href: '/reviewer/chief-review',
        label: 'Chief Review',
        icon: ClipboardCheck,
        chiefOnly: true,
      },
      {
        href: '/reviewer/assignments',
        label: 'Assign Reviewers',
        icon: UserPlus,
        chiefOnly: true,
      },
    ],
  },
  admin: {
    label: 'Admin',
    items: [
      { href: '/admin/cycles', label: 'Cycles', icon: Calendar },
      {
        href: '/admin/applications',
        label: 'Application Forms',
        icon: FileText,
      },
      { href: '/admin/members', label: 'Members', icon: Users },
    ],
  },
}

// Display order: applicant, then reviewer, then admin
const roleOrder: Role[] = ['applicant', 'reviewer', 'admin']

function SidebarUser({ fullName }: { fullName: string }) {
  const router = useRouter()
  const { signOut } = useAuth()

  async function handleSignOut() {
    await signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="-mx-3 border-t border-gray-200 px-3 py-2 pb-6">
      <div className="flex flex-1 items-center justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={fullName} size="sm" />
          <span className="text-text-default truncate text-sm font-medium">
            {fullName}
          </span>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          aria-label="Sign out"
          className="text-text-subtle hover:text-text-default flex-shrink-0 rounded-md p-1.5 transition-colors hover:bg-gray-100"
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  )
}

export default function Sidebar({ roles, fullName, isChief }: SidebarProps) {
  const sections = roleOrder
    .filter((role) => roles.includes(role))
    .map((role) => sectionsByRole[role])
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.chiefOnly || isChief),
    }))

  return (
    <aside className="flex h-screen w-60 flex-col bg-gray-50">
      {/* Logo */}
      <div className="flex flex-shrink-0 items-center gap-3 px-3 py-3">
        <Image
          src="/GenerateNU Logo.png"
          alt="GenerateNU"
          width={32}
          height={32}
          className="object-contain"
        />
        <span className="text-brand-blue text-xl font-semibold">Generate</span>
      </div>

      {/* Nav sections */}
      <nav className="flex flex-1 flex-col gap-4 overflow-hidden px-3 py-4">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="text-text-subtle mb-2 px-2 text-xs font-semibold tracking-wider uppercase">
              {section.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {section.items.map(({ href, label, icon }) => (
                <NavItem key={href} href={href} label={label} icon={icon} />
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
