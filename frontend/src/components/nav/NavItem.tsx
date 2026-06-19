'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'

interface NavItemProps {
  href: string
  label: string
  icon: LucideIcon
}

export default function NavItem({ href, label, icon: Icon }: NavItemProps) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        isActive
          ? 'text-brand-blue bg-blue-50'
          : 'text-text-secondary hover:text-text-default hover:bg-gray-100'
      }`}
    >
      <Icon
        size={16}
        className={isActive ? 'text-brand-blue' : 'text-text-subtle'}
      />
      {label}
    </Link>
  )
}
