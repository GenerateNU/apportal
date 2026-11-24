import { cn } from '@/lib/utils'

export function MetaList({
  items,
  className,
}: {
  items: React.ReactNode[]
  className?: string
}) {
  const shown = items.filter(
    (i) => i !== null && i !== undefined && i !== false && i !== ''
  )
  return (
    <span
      className={cn(
        'inline-flex flex-wrap items-center gap-x-3 gap-y-0.5',
        className
      )}
    >
      {shown.map((item, i) => (
        <span key={i}>{item}</span>
      ))}
    </span>
  )
}
