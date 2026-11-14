'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { Tooltip } from '@/components/Tooltip'

interface NavItemProps {
  href: string
  label: string
  icon: LucideIcon
  // Icon-only, with the label as a hover tooltip instead of inline text.
  collapsed?: boolean
}

export function isNavItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/')
}

export default function NavItem({
  href,
  label,
  icon: Icon,
  collapsed,
}: NavItemProps) {
  const pathname = usePathname()
  const isActive = isNavItemActive(pathname, href)

  const link = (
    <Link
      href={href}
      aria-label={collapsed ? label : undefined}
      className={`relative flex items-center gap-3 px-3 py-2 text-sm transition-colors ${collapsed ? 'justify-center' : ''} ${
        isActive
          ? 'before:bg-ink text-ink bg-gray-100 font-semibold before:absolute before:inset-y-1 before:left-0 before:w-[3px]'
          : 'text-ink/70 hover:text-ink font-medium hover:bg-gray-50'
      }`}
    >
      <Icon
        size={16}
        className={`shrink-0 ${isActive ? 'text-ink' : 'text-ink/50'}`}
      />
      {!collapsed && label}
    </Link>
  )

  return collapsed ? (
    <Tooltip label={label}>
      <span className="block w-full">{link}</span>
    </Tooltip>
  ) : (
    link
  )
}
