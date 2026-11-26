'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { Tooltip } from '@/components/Tooltip'
import { toCycleTemplate } from '@/lib/cycle-paths'

interface NavItemProps {
  href: string
  label: string
  icon: LucideIcon
  // Icon-only, with the label as a hover tooltip instead of inline text.
  collapsed?: boolean
  also?: string[]
}

export function isNavItemActive(pathname: string, href: string) {
  const path = toCycleTemplate(pathname)
  const target = toCycleTemplate(href.split('?')[0])
  return path === target || path.startsWith(target + '/')
}

export default function NavItem({
  href,
  label,
  icon: Icon,
  collapsed,
  also = [],
}: NavItemProps) {
  const pathname = usePathname()
  // ?from= means a cycle step opened this page, so the step is highlighted instead.
  const viaStep = useSearchParams().has('from')
  const isActive =
    !viaStep && [href, ...also].some((h) => isNavItemActive(pathname, h))

  const link = (
    <Link
      href={href}
      aria-label={collapsed ? label : undefined}
      className={
        collapsed
          ? `mx-auto flex size-10 items-center justify-center transition-colors ${
              isActive
                ? 'bg-ink text-white'
                : 'text-ink/60 hover:text-ink hover:bg-gray-100'
            }`
          : `relative flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
              isActive
                ? 'before:bg-ink text-ink bg-gray-100 font-semibold before:absolute before:inset-y-1 before:left-0 before:w-[3px]'
                : 'text-ink/70 hover:text-ink font-medium hover:bg-gray-50'
            }`
      }
    >
      <Icon
        size={collapsed ? 18 : 16}
        className={`shrink-0 ${
          collapsed ? '' : isActive ? 'text-ink' : 'text-ink/50'
        }`}
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
