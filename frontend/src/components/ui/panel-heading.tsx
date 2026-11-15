import { cn } from '@/lib/utils'

export function PanelHeading({
  as: Tag = 'h2',
  aside,
  action,
  className,
  children,
}: {
  as?: 'h2' | 'h3'
  aside?: React.ReactNode
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'flex min-h-8 items-center justify-between gap-4 border-b border-gray-200 pb-2',
        className
      )}
    >
      <Tag className="font-display text-ink text-sm font-bold tracking-wider uppercase">
        {children}
      </Tag>
      {(aside || action) && (
        <div className="flex shrink-0 items-center gap-3">
          {aside && (
            <span className="font-display text-text-subtle text-[11px] tracking-wider uppercase">
              {aside}
            </span>
          )}
          {action}
        </div>
      )}
    </div>
  )
}
