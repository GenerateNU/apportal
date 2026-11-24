import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Fact({
  icon: Icon,
  children,
  className,
}: {
  icon: LucideIcon
  children: React.ReactNode
  className?: string
}) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <Icon size={14} aria-hidden className="shrink-0 opacity-60" />
      <span className="truncate">{children}</span>
    </span>
  )
}

export function Facts({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn('flex flex-wrap items-center gap-x-4 gap-y-1', className)}
    >
      {children}
    </span>
  )
}

type Stat = { label: string; value: React.ReactNode }

export function Stats({
  items,
  className,
}: {
  items: (Stat | false | null | undefined)[]
  className?: string
}) {
  const shown = items.filter((s): s is Stat => !!s)
  return (
    <span className={cn('inline-flex flex-wrap gap-x-6 gap-y-2', className)}>
      {shown.map((s) => (
        <span key={s.label} className="inline-flex flex-col gap-0.5 text-left">
          <span className="font-display text-[10px] font-bold tracking-[0.12em] uppercase opacity-60">
            {s.label}
          </span>
          <span className="text-sm font-semibold tabular-nums">{s.value}</span>
        </span>
      ))}
    </span>
  )
}
