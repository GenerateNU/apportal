import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

export function BackLink({
  href,
  children,
  className,
}: {
  href: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'font-display text-text-muted hover:text-ink inline-flex w-fit items-center gap-1.5 text-xs tracking-wider uppercase',
        className
      )}
    >
      <ArrowLeft size={14} />
      {children}
    </Link>
  )
}
