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

export default function NavItem({
  href,
  label,
  icon: Icon,
  collapsed,
}: NavItemProps) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(href + '/')

  const link = (
    <Link
      href={href}
      aria-label={collapsed ? label : undefined}
      className={`flex items-center gap-2.5 rounded-md px-2.5 py-2.5 text-sm font-medium transition-colors ${collapsed ? 'justify-center' : ''} ${
        isActive
          ? 'text-brand-blue bg-blue-50'
          : 'text-text-secondary hover:text-text-default hover:bg-gray-100'
      }`}
    >
      <Icon
        size={16}
        className={`shrink-0 ${isActive ? 'text-brand-blue' : 'text-text-subtle'}`}
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
