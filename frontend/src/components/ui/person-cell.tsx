import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

export function PersonCell({
  name,
  secondary,
  trailing,
  className,
  wrap = false,
}: {
  name: string
  secondary?: React.ReactNode
  trailing?: React.ReactNode
  className?: string
  wrap?: boolean
}) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <Avatar name={name} size="sm" />
      <div className="min-w-0">
        <p
          className={cn(
            'text-ink text-sm font-semibold',
            wrap ? 'wrap-anywhere' : 'truncate'
          )}
        >
          {name}
        </p>
        {secondary && (
          <p
            className={cn(
              'text-text-subtle text-xs',
              wrap ? 'wrap-anywhere' : 'truncate'
            )}
          >
            {secondary}
          </p>
        )}
      </div>
      {trailing}
    </div>
  )
}
