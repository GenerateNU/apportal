import { cn } from '@/lib/utils'

export function EmptyState({
  title,
  description,
  action,
  size = 'lg',
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  size?: 'lg' | 'sm' | 'inline'
  className?: string
}) {
  if (size === 'inline') {
    return (
      <p className={cn('text-text-muted px-4 py-3 text-sm', className)}>
        {title}
      </p>
    )
  }
  return (
    <div
      className={cn(
        'border border-dashed border-gray-300 bg-white text-center',
        size === 'lg' ? 'p-10' : 'px-4 py-6',
        className
      )}
    >
      <p className="text-ink text-sm font-medium">{title}</p>
      {description && (
        <p className="text-text-muted mt-1 text-sm">{description}</p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
