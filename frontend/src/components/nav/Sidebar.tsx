'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  Users,
  UserPlus,
  FileText,
  Calendar,
  ChevronsLeft,
  ChevronsRight,
  ClipboardCheck,
  ListChecks,
  ListOrdered,
  Shuffle,
  Mic,
  ScrollText,
  Scale,
  Star,
  Video,
  Wand2,
  LogOut,
  CalendarClock,
} from 'lucide-react'
import NavItem, { isNavItemActive } from './NavItem'
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
  id: string
  // A section without a label is the role's personal queue: it sits at the top
  // of the rail with no header, and so can't be collapsed.
  label?: string
  items: NavItemConfig[]
}

const sectionsByRole: Record<Role, NavSection[]> = {
  applicant: [
    {
      id: 'apply',
      items: [
        {
          href: '/applicant/applications',
          label: 'Apply',
          icon: FileText,
        },
      ],
    },
  ],
  reviewer: [
    {
      id: 'my-work',
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
          href: '/reviewer/preference-lists',
          label: 'Preference Lists',
          icon: ListOrdered,
        },
        {
          href: '/reviewer/draft',
          label: 'Draft',
          icon: Shuffle,
          chiefOnly: true,
        },
      ],
    },
    {
      id: 'reviews',
      label: 'Reviews',
      items: [
        {
          href: '/reviewer/assignment-plan',
          label: 'Plan Assignments',
          icon: Wand2,
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
          href: '/reviewer/chief-review',
          label: 'Chief Review',
          icon: ClipboardCheck,
          chiefOnly: true,
        },
      ],
    },
    {
      id: 'interviews',
      label: 'Interviews',
      items: [
        {
          href: '/reviewer/interview-assignment-plan',
          label: 'Plan Interviews',
          icon: CalendarClock,
          chiefOnly: true,
        },
        {
          href: '/reviewer/interview-assignments',
          label: 'Interview Assignments',
          icon: Video,
          chiefOnly: true,
        },
      ],
    },
  ],
  admin: [
    {
      id: 'admin',
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
  ],
}

// Display order: applicant, then reviewer, then admin
const roleOrder: Role[] = ['applicant', 'reviewer', 'admin']

const SECTIONS_COLLAPSED_KEY = 'sidebar-sections-collapsed'

function useCollapsedSections() {
  const [collapsedIds, setCollapsedIds] = useState<Record<string, boolean>>({})
  // Gates the persist effect so it can't write the empty default over stored
  // state before the restore below lands.
  const [restored, setRestored] = useState(false)

  // Restored once on mount — done in an effect (rather than a useState
  // initializer) so the server-rendered markup and the first client render
  // match before localStorage is consulted.
  useEffect(() => {
    const stored = localStorage.getItem(SECTIONS_COLLAPSED_KEY)
    try {
      const parsed: unknown = stored ? JSON.parse(stored) : null
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCollapsedIds(parsed as Record<string, boolean>)
      }
    } catch {
      localStorage.removeItem(SECTIONS_COLLAPSED_KEY)
    }
    setRestored(true)
  }, [])

  // Persisted from an effect, not from the setters, because expandSection runs
  // during render.
  useEffect(() => {
    if (!restored) return
    localStorage.setItem(SECTIONS_COLLAPSED_KEY, JSON.stringify(collapsedIds))
  }, [collapsedIds, restored])

  function toggleSection(id: string) {
    setCollapsedIds((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function expandSection(id: string) {
    setCollapsedIds((prev) => (prev[id] ? { ...prev, [id]: false } : prev))
  }

  return { collapsedIds, toggleSection, expandSection }
}

// A solid caret rather than lucide's stroked chevron, which reads too light
// next to the label.
function SectionCaret({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      viewBox="0 0 10 10"
      width={10}
      height={10}
      aria-hidden
      className={`shrink-0 fill-current transition-transform ${collapsed ? '-rotate-90' : ''}`}
    >
      <path d="M1 3.25h8L5 7.75z" />
    </svg>
  )
}

function NavSectionGroup({
  section,
  railCollapsed,
  sectionCollapsed,
  onToggle,
}: {
  section: NavSection
  railCollapsed?: boolean
  sectionCollapsed: boolean
  onToggle: () => void
}) {
  const contentId = `nav-section-${section.id}`
  // The icon-only rail hides section headers, leaving nothing to click to
  // expand a section again — so show every item there regardless.
  const showItems = railCollapsed || !sectionCollapsed

  return (
    <div>
      {section.label && !railCollapsed && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!sectionCollapsed}
          aria-controls={contentId}
          className="text-text-subtle hover:text-text-default mb-0.5 flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-gray-100"
        >
          {section.label}
          <SectionCaret collapsed={sectionCollapsed} />
        </button>
      )}
      <div
        id={contentId}
        className={`flex-col gap-1 ${showItems ? 'flex' : 'hidden'}`}
      >
        {section.items.map(({ href, label, icon }) => (
          <NavItem
            key={href}
            href={href}
            label={label}
            icon={icon}
            collapsed={railCollapsed}
          />
        ))}
      </div>
    </div>
  )
}

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
  const pathname = usePathname()
  const { collapsedIds, toggleSection, expandSection } = useCollapsedSections()

  const sections = roleOrder
    .filter((role) => roles.includes(role))
    .flatMap((role) => sectionsByRole[role])
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.chiefOnly || isChief),
    }))
    .filter((section) => section.items.length > 0)

  // Navigating into a collapsed section expands it, so the active item is
  // never hidden. Easy to hit from the icon-only rail, which shows every item
  // regardless of section state. Keyed on the change so a section holding the
  // current page can still be collapsed by hand.
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    const active = sections.find((section) =>
      section.items.some((item) => isNavItemActive(pathname, item.href))
    )
    if (active) expandSection(active.id)
  }

  return (
    <aside
      className={`flex h-screen flex-col bg-gray-50 transition-[width] duration-200 ${collapsed ? 'w-16' : 'w-60'}`}
    >
      {/* Logo, with the rail toggle sharing the row. The collapsed rail is too
          narrow to fit both, so there the toggle stacks underneath. */}
      <div
        className={`flex flex-shrink-0 items-center px-3 py-3 ${collapsed ? 'flex-col gap-2' : 'gap-3'}`}
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
        {onToggleCollapsed && (
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
        )}
      </div>

      {/* Nav sections */}
      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 pt-2 pb-4">
        {sections.map((section) => (
          <NavSectionGroup
            key={section.id}
            section={section}
            railCollapsed={collapsed}
            sectionCollapsed={!!collapsedIds[section.id]}
            onToggle={() => toggleSection(section.id)}
          />
        ))}
      </nav>

      {/* User */}
      {fullName && <SidebarUser fullName={fullName} collapsed={collapsed} />}
    </aside>
  )
}
