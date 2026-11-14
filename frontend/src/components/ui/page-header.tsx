import { cn } from '@/lib/utils'

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
  size = 'lg',
  className,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  back?: React.ReactNode
  size?: 'lg' | 'md'
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {back}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1
            className={cn(
              'font-display text-ink font-bold tracking-tight uppercase',
              size === 'lg' ? 'text-2xl sm:text-3xl' : 'text-xl'
            )}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="text-text-muted mt-1 text-sm">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
