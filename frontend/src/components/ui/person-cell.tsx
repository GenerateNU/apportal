import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

export function PersonCell({
  name,
  secondary,
  trailing,
  className,
}: {
  name: string
  secondary?: React.ReactNode
  trailing?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <Avatar name={name} size="sm" />
      <div className="min-w-0">
        <p className="text-ink truncate text-sm font-semibold">{name}</p>
        {secondary && (
          <p className="text-text-subtle truncate text-xs">{secondary}</p>
        )}
      </div>
      {trailing}
    </div>
  )
}
