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
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="max-w-2xl min-w-0 flex-[1_1_20rem]">
          <h1
            className={cn(
              'font-display text-ink font-bold tracking-tight uppercase',
              size === 'lg' ? 'text-2xl sm:text-3xl' : 'text-xl'
            )}
          >
            {title}
          </h1>
          {subtitle && (
            <div className="text-text-muted mt-1 text-sm">{subtitle}</div>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  )
}
