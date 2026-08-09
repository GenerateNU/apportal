import Link from 'next/link'
import { ArrowRight, CheckCircle2, Clock } from 'lucide-react'
import { Tooltip } from '@/components/Tooltip'
import type { ApplicationSummary } from '@/lib/api/types'
import {
  stageBadge,
  stageLabel,
} from '@/app/(portal)/reviewer/applications/components/constants'
import {
  REVIEW_STATE_BADGE,
  REVIEW_STATE_DOT,
  REVIEW_STATE_LABEL,
  type ReviewState,
} from '../constants'

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function longDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

// One application in a lead's queue of 25–30. Grid, not flex: flex-1 splits
// leftover space, so a short badge shifts every other column's left edge.
// Hidden cells aren't grid items, so each breakpoint lists only its own tracks.
export function ReviewRow({
  application,
  state,
  submittedAt,
}: {
  application: ApplicationSummary
  state: ReviewState
  // When this lead submitted their own review, if they have.
  submittedAt?: string
}) {
  return (
    <Link
      href={`/reviewer/my-reviews/${application.id}`}
      className="group grid grid-cols-[1rem_minmax(0,1fr)_7rem_1rem] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-gray-50 sm:grid-cols-[1rem_minmax(0,1fr)_minmax(0,1.2fr)_5rem_7rem_1rem] lg:grid-cols-[1rem_minmax(0,1fr)_minmax(0,1.2fr)_9.5rem_5rem_7rem_1rem]"
    >
      <span
        className={`h-4 w-4 rounded-full border-2 ${REVIEW_STATE_DOT[state]}`}
      />

      <span className="text-text-default min-w-0 truncate text-sm font-medium">
        {application.full_name || application.user_nuid}
      </span>
      <span className="text-text-subtle hidden min-w-0 truncate text-xs sm:block">
        {application.email || application.user_nuid}
      </span>

      <span className="hidden lg:block">
        <span
          className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${stageBadge[application.stage]}`}
        >
          {stageLabel[application.stage]}
        </span>
      </span>

      <span className="text-text-subtle hidden text-xs sm:flex">
        {application.submitted_at && (
          <Tooltip label="Application submitted">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {shortDate(application.submitted_at)}
            </span>
          </Tooltip>
        )}
      </span>

      <span className="flex">
        <Tooltip
          label={
            submittedAt
              ? `You submitted your review ${longDate(submittedAt)}`
              : state === 'draft'
                ? 'You have a saved draft of this review'
                : 'You have not started this review'
          }
        >
          <span
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${REVIEW_STATE_BADGE[state]}`}
          >
            {state === 'submitted' && <CheckCircle2 className="h-3 w-3" />}
            {REVIEW_STATE_LABEL[state]}
          </span>
        </Tooltip>
      </span>

      {/* Same hover affordance as the applicant's apply card. */}
      <span className="text-text-faint group-hover:text-brand-blue flex items-center transition-colors">
        <ArrowRight
          size={16}
          className="transition-transform group-hover:translate-x-1"
        />
      </span>
    </Link>
  )
}
