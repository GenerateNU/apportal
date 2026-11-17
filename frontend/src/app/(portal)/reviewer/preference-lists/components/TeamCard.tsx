import Link from 'next/link'
import { ArrowRight, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { PreferenceListSummary } from '@/lib/api/types'
import {
  PREFERENCE_LIST_STATUS_BADGE,
  PREFERENCE_LIST_STATUS_LABEL,
} from '@/lib/preference-list-status'
import { MEETING_DAY_LABEL } from '@/app/(portal)/reviewer/applications/components/meetingAvailability'

export function TeamCard({
  list,
  onDelete,
}: {
  list: PreferenceListSummary
  onDelete?: () => void
}) {
  return (
    <div className="group relative flex flex-col gap-3 border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/reviewer/preference-lists/${list.id}`}
          className="text-ink truncate font-semibold after:absolute after:inset-0"
        >
          {list.name}
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          <Badge
            size="sm"
            className={PREFERENCE_LIST_STATUS_BADGE[list.status]}
          >
            {PREFERENCE_LIST_STATUS_LABEL[list.status]}
          </Badge>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Delete ${list.name}`}
              className="text-text-faint relative z-10 p-1 hover:text-red-600"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      <p className="text-text-muted line-clamp-2 text-sm">
        {list.member_names.length > 0
          ? list.member_names.join(', ')
          : 'No members yet'}
      </p>
      <div className="text-text-subtle mt-auto flex items-center justify-between text-xs">
        <span>
          {list.entry_count} ranked
          {list.meeting_day &&
            ` · meets ${MEETING_DAY_LABEL[list.meeting_day]}`}
        </span>
        <ArrowRight
          size={14}
          className="group-hover:text-ink transition-transform group-hover:translate-x-1"
        />
      </div>
    </div>
  )
}
