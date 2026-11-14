import { cn } from '@/lib/utils'

export function SectionLabel({
  as: Tag = 'h2',
  className,
  children,
}: {
  as?: 'h2' | 'h3' | 'p' | 'span'
  className?: string
  children: React.ReactNode
}) {
  return (
    <Tag
      className={cn(
        'font-display text-text-subtle text-[11px] font-bold tracking-[0.12em] uppercase',
        className
      )}
    >
      {children}
    </Tag>
  )
}
