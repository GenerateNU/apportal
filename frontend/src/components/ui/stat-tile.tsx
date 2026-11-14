import { cn } from '@/lib/utils'

export function StatStrip({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-wrap gap-6', className)} {...props} />
}

export function StatTile({
  label,
  value,
  hint,
}: {
  label: React.ReactNode
  value: React.ReactNode
  hint?: React.ReactNode
}) {
  return (
    <div className="flex flex-col">
      <span className="font-display text-text-subtle text-[11px] tracking-wider uppercase">
        {label}
      </span>
      <span className="text-ink text-sm font-semibold">{value}</span>
      {hint && <span className="text-text-faint text-xs">{hint}</span>}
    </div>
  )
}
