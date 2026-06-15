'use client'

import Image from 'next/image'
import {
  LayoutDashboard,
  Users,
  FileText,
  RefreshCw,
  Settings,
  Layers,
} from 'lucide-react'
import NavItem from './NavItem'
import type { Role } from '@/types/roles'

interface SidebarProps {
  roles: Role[]
  firstName?: string
  lastName?: string
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
    ],
  },
  admin: {
    label: 'Admin',
    items: [
      { href: '/admin/cycles', label: 'Cycles', icon: RefreshCw },
      { href: '/admin/builder', label: 'App Builder', icon: Layers },
      { href: '/admin/roles', label: 'Roles', icon: Settings },
    ],
  },
}

// Display order: reviewer sections before applicant, admin last
const roleOrder: Role[] = ['reviewer', 'applicant', 'admin']

function SidebarUser({
  firstName,
  lastName,
}: {
  firstName: string
  lastName: string
}) {
  return (
    <div className="border-t border-gray-100 px-4 py-3">
      <div className="flex items-center gap-2.5">
        <div className="bg-brand-blue flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white">
          {firstName[0]}
          {lastName[0]}
        </div>
        <span className="text-sm font-medium text-gray-700">
          {firstName} {lastName}
        </span>
      </div>
    </div>
  )
}

export default function Sidebar({ roles, firstName, lastName }: SidebarProps) {
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
        <span className="text-xl font-semibold text-brand-blue">Generate</span>
      </div>

      {/* Nav sections */}
      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="mb-1 px-3 text-xs font-medium tracking-wider text-gray-400 uppercase">
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
      {firstName && lastName && (
        <SidebarUser firstName={firstName} lastName={lastName} />
      )}
    </aside>
  )
}
