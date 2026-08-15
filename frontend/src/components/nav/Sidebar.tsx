'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  Users,
  UserPlus,
  FileText,
  Calendar,
  ChevronsLeft,
  ChevronsRight,
  ClipboardCheck,
  ListChecks,
  Mic,
  ScrollText,
  Scale,
  Star,
  Video,
  Wand2,
  LogOut,
  CalendarClock,
} from 'lucide-react'
import NavItem from './NavItem'
import { Avatar } from '@/components/ui/avatar'
import { Tooltip } from '@/components/Tooltip'
import { useAuth } from '@/lib/auth/auth-context'
import type { Role } from '@/types/roles'

interface SidebarProps {
  roles: Role[]
  fullName?: string
  // Whether the user can act as a chief (holds the chief or admin role). Some
  // reviewer nav items are chief-only actions.
  isChief?: boolean
  // Icon-only rail, with labels as hover tooltips. Omit both props (as the
  // mobile nav sheet does) to always render expanded with no toggle — a
  // slide-out drawer has no reason to collapse further.
  collapsed?: boolean
  onToggleCollapsed?: () => void
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
      { href: '/reviewer/my-reviews', label: 'Lead Review', icon: FileText },
      { href: '/reviewer/my-interviews', label: 'My Interviews', icon: Mic },
      {
        href: '/reviewer/interview-script',
        label: 'Interview Script',
        icon: ScrollText,
      },
      {
        href: '/reviewer/interview-ratings',
        label: 'Interview Ratings',
        icon: Star,
      },
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
      {
        href: '/reviewer/review-progress',
        label: 'Review Progress',
        icon: ListChecks,
        chiefOnly: true,
      },
      {
        href: '/reviewer/review-calibration',
        label: 'Review Calibration',
        icon: Scale,
        chiefOnly: true,
      },
      {
        href: '/reviewer/assignment-plan',
        label: 'Plan Assignments',
        icon: Wand2,
        chiefOnly: true,
      },
      {
        href: '/reviewer/interview-assignments',
        label: 'Interview Assignments',
        icon: Video,
        chiefOnly: true,
      },
      {
        href: '/reviewer/interview-assignment-plan',
        label: 'Plan Interviews',
        icon: CalendarClock,
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

function SidebarUser({
  fullName,
  collapsed,
}: {
  fullName: string
  collapsed?: boolean
}) {
  const router = useRouter()
  const { signOut } = useAuth()

  async function handleSignOut() {
    await signOut()
    router.push('/login')
    router.refresh()
  }

  const signOutButton = (
    <button
      type="button"
      onClick={handleSignOut}
      aria-label="Sign out"
      className="text-text-subtle hover:text-text-default flex-shrink-0 rounded-md p-2 transition-colors hover:bg-gray-100"
    >
      <LogOut size={16} />
    </button>
  )

  if (collapsed) {
    return (
      <div className="-mx-3 flex flex-col items-center gap-2 border-t border-gray-200 px-3 py-2 pb-6">
        <Tooltip label={fullName}>
          <Avatar name={fullName} size="sm" />
        </Tooltip>
        {signOutButton}
      </div>
    )
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
        {signOutButton}
      </div>
    </div>
  )
}

export default function Sidebar({
  roles,
  fullName,
  isChief,
  collapsed,
  onToggleCollapsed,
}: SidebarProps) {
  const sections = roleOrder
    .filter((role) => roles.includes(role))
    .map((role) => sectionsByRole[role])
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.chiefOnly || isChief),
    }))

  return (
    <aside
      className={`flex h-screen flex-col bg-gray-50 transition-[width] duration-200 ${collapsed ? 'w-16' : 'w-60'}`}
    >
      {/* Logo */}
      <div
        className={`flex flex-shrink-0 items-center gap-3 px-3 py-3 ${collapsed ? 'justify-center' : ''}`}
      >
        <Image
          src="/GenerateNU Logo.png"
          alt="GenerateNU"
          width={32}
          height={32}
          className="object-contain"
        />
        {!collapsed && (
          <span className="text-brand-blue flex-1 text-xl font-semibold">
            Generate
          </span>
        )}
      </div>

      {onToggleCollapsed && (
        <div
          className={`flex flex-shrink-0 px-3 pb-2 ${collapsed ? 'justify-center' : 'justify-end'}`}
        >
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="text-text-subtle hover:text-text-default rounded-md p-1.5 transition-colors hover:bg-gray-100"
          >
            {collapsed ? (
              <ChevronsRight size={16} />
            ) : (
              <ChevronsLeft size={16} />
            )}
          </button>
        </div>
      )}

      {/* Nav sections */}
      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <p className="text-text-subtle mb-2 px-2 text-xs font-semibold tracking-wider uppercase">
                {section.label}
              </p>
            )}
            <div className="flex flex-col gap-1">
              {section.items.map(({ href, label, icon }) => (
                <NavItem
                  key={href}
                  href={href}
                  label={label}
                  icon={icon}
                  collapsed={collapsed}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      {fullName && <SidebarUser fullName={fullName} collapsed={collapsed} />}
    </aside>
  )
}
