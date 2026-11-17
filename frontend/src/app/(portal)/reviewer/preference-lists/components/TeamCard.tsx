import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { PreferenceListSummary } from '@/lib/api/types'
import {
  PREFERENCE_LIST_STATUS_BADGE,
  PREFERENCE_LIST_STATUS_LABEL,
} from '@/lib/preference-list-status'
import { MEETING_DAY_LABEL } from '@/app/(portal)/reviewer/applications/components/meetingAvailability'

export function TeamCard({
  list,
  counts,
  countsLoading,
}: {
  list: PreferenceListSummary
  counts: { label: string; count: number }[]
  countsLoading?: boolean
}) {
  const people =
    list.member_names.length > 0
      ? list.member_names.join(', ')
      : 'No members yet'

  return (
    <div className="group relative flex flex-col border border-gray-200 bg-white transition-colors hover:border-gray-300">
      <div className="flex flex-col gap-1 p-4">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/reviewer/preference-lists/${list.id}`}
            className="text-ink truncate font-semibold after:absolute after:inset-0"
          >
            {list.name}
          </Link>
          <Badge
            size="sm"
            className={cn(
              'shrink-0',
              PREFERENCE_LIST_STATUS_BADGE[list.status]
            )}
          >
            {PREFERENCE_LIST_STATUS_LABEL[list.status]}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <p
            className="text-text-muted min-w-0 flex-1 truncate text-sm"
            title={people}
          >
            {people}
            {list.meeting_day && ` · ${MEETING_DAY_LABEL[list.meeting_day]}`}
          </p>
        </div>
      </div>
      {counts.length > 0 && (
        <div
          className="mt-auto grid divide-x divide-gray-100 border-t border-gray-100"
          style={{ gridTemplateColumns: `repeat(${counts.length}, 1fr)` }}
        >
          {counts.map((c) => (
            <div key={c.label} className="flex flex-col px-4 py-3">
              {countsLoading ? (
                <Skeleton className="my-1 h-5 w-6" />
              ) : (
                <span className="text-ink text-lg font-semibold tabular-nums">
                  {c.count}
                </span>
              )}
              <span className="text-text-subtle truncate text-xs">
                {c.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
