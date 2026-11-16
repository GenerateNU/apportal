import { CalendarClock, type LucideIcon } from 'lucide-react'
import { formatDeadline, timeLeft } from '@/lib/deadline'
import { cn } from '@/lib/utils'

export function DueLine({
  date,
  label = 'Due',
  icon: Icon = CalendarClock,
}: {
  date: Date
  label?: string
  icon?: LucideIcon
}) {
  const left = timeLeft(date)
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
      <Icon size={15} className="text-text-subtle shrink-0" />
      <span className="text-ink font-medium">
        {label} {formatDeadline(date)}
      </span>
      <span
        className={cn(
          left.passed
            ? 'text-text-subtle'
            : left.soon
              ? 'font-medium text-amber-600'
              : 'text-text-muted'
        )}
      >
        {left.text}
      </span>
    </span>
  )
}
