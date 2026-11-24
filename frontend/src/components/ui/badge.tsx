import { cn } from '@/lib/utils'

// Pass a color map entry (e.g. stageBadge[stage]) as className; neutral by default.
export function Badge({
  className,
  size = 'md',
  ...props
}: React.ComponentProps<'span'> & { size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'inline-flex w-fit shrink-0 items-center gap-1 bg-gray-100 font-medium whitespace-nowrap',
        size === 'md' ? 'px-2 py-0.5 text-xs' : 'px-1.5 py-px text-[11px]',
        className
      )}
      {...props}
    />
  )
}

export function StatusDot({ className }: { className?: string }) {
  return <span className={cn('h-2 w-2 shrink-0 rounded-full', className)} />
}

export function Count({ value }: { value: number }) {
  return (
    <Badge size="sm" className="text-text-muted tabular-nums">
      {value}
    </Badge>
  )
}
