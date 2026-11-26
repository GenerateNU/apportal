import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { PreferenceListSummary } from '@/lib/api/types'
import {
  PREFERENCE_LIST_STATUS_BADGE,
  PREFERENCE_LIST_STATUS_LABEL,
} from '@/lib/preference-list-status'
import { MEETING_DAY_LABEL } from '@/app/(portal)/(staff)/cycles/[cycleId]/applicants/components/meetingAvailability'
import { cycleHref } from '@/lib/cycle-paths'

export function TeamCard({ list }: { list: PreferenceListSummary }) {
  const people =
    list.member_names.length > 0
      ? list.member_names.join(', ')
      : 'No members yet'

  return (
    <div className="group relative flex flex-col border border-gray-200 bg-white transition-colors hover:border-gray-300">
      <div className="flex flex-col gap-1 p-4">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={cycleHref(list.cycle_id, `/cycle/teams/${list.id}`)}
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
          </p>
          {list.meeting_day && (
            <Badge size="sm" className="text-text-muted shrink-0">
              Meets {MEETING_DAY_LABEL[list.meeting_day]}
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}
