import { cn } from '@/lib/utils'
import {
  APPLICATION_TYPE_LABEL,
  type ApplicationType,
} from '../../cycles/lib/cycle-meta'

// e.g. "Lead cycle"; unknown types fall back to the raw value.
export function applicationTypeLabel(type: string) {
  const label =
    type in APPLICATION_TYPE_LABEL
      ? APPLICATION_TYPE_LABEL[type as ApplicationType]
      : type
  return `${label} cycle`
}

export function ApplicationTypeBadge({
  type,
  size = 'md',
}: {
  type: string
  size?: 'md' | 'lg'
}) {
  return (
    <span
      className={cn(
        'border-ink text-ink font-display inline-flex w-fit items-center border-2 bg-white font-bold tracking-wider uppercase',
        size === 'lg' ? 'px-3 py-1 text-base' : 'px-2.5 py-0.5 text-sm'
      )}
    >
      {applicationTypeLabel(type)}
    </span>
  )
}
