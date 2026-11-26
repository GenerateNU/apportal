import type { RealtimeStatus } from '@/lib/realtime/useDraftRealtime'
import { cn } from '@/lib/utils'

const LABEL: Record<RealtimeStatus, string> = {
  live: 'Live',
  connecting: 'Connecting…',
  offline: 'Reconnecting…',
}

export function LiveIndicator({ status }: { status: RealtimeStatus }) {
  return (
    <span
      className="text-text-muted inline-flex items-center gap-1.5 font-sans text-xs font-normal tracking-normal normal-case"
      title={
        status === 'live'
          ? 'Updates appear as soon as a chief makes them.'
          : 'Updates may be delayed until the live connection is back.'
      }
    >
      <span className="relative flex size-2">
        {status === 'live' && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        )}
        <span
          className={cn(
            'relative inline-flex size-2 rounded-full',
            status === 'live'
              ? 'bg-emerald-500'
              : status === 'offline'
                ? 'bg-amber-500'
                : 'bg-gray-300'
          )}
        />
      </span>
      {LABEL[status]}
    </span>
  )
}
