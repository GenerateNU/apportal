import { cn } from '@/lib/utils'

export function LoadingText({
  label = 'Loading…',
  className,
}: {
  label?: string
  className?: string
}) {
  return <p className={cn('text-text-faint text-sm', className)}>{label}</p>
}
