import { AlertCircle, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SaveIndicatorStatus = 'idle' | 'saving' | 'saved' | 'error'

const STATES = {
  saving: {
    label: 'Saving…',
    icon: Loader2,
    className: 'border-gray-200 bg-gray-50 text-text-secondary',
  },
  saved: {
    label: 'Saved',
    icon: Check,
    className: 'border-status-open/30 bg-status-open/10 text-status-open',
  },
  error: {
    label: 'Couldn’t save',
    icon: AlertCircle,
    className: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
}

// For pages that save as you type, so it's always clear whether work landed.
// A fixed-width slot that's always there, so the header never shifts as the
// label comes and goes, and screen readers hear each change.
export function SaveIndicator({
  status,
  className,
}: {
  status: SaveIndicatorStatus
  className?: string
}) {
  const state = status === 'idle' ? null : STATES[status]
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn('inline-flex w-28 shrink-0 justify-end', className)}
    >
      {state && (
        <span
          className={cn(
            'inline-flex items-center gap-1 border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap',
            state.className
          )}
        >
          <state.icon
            className={cn('h-3 w-3', status === 'saving' && 'animate-spin')}
            aria-hidden
          />
          {state.label}
        </span>
      )}
    </span>
  )
}
