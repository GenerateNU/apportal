import Link from 'next/link'
import { ArrowRight, CheckCircle2, Clock } from 'lucide-react'
import { Tooltip } from '@/components/Tooltip'
import { Badge } from '@/components/ui/badge'
import { TABLE_ROW } from '@/components/ui/table-styles'
import { cn } from '@/lib/utils'
import type { ApplicationStage } from '@/lib/api/types'
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

// Grid, not flex: flex-1 splits leftover space, so a short badge shifts every
// other column's left edge. Hidden cells aren't grid items, so each breakpoint
// lists only its own tracks.
const GRID =
  'grid-cols-[1rem_minmax(0,1fr)_7rem_1rem] sm:grid-cols-[1rem_minmax(0,1fr)_minmax(0,1.2fr)_5rem_7rem_1rem]'
const GRID_WITH_STAGE = `${GRID} lg:grid-cols-[1rem_minmax(0,1fr)_minmax(0,1.2fr)_9.5rem_5rem_7rem_1rem]`

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

export function ReviewRow({
  href,
  name,
  email,
  stage,
  date,
  dateTooltip = 'Application submitted',
  state,
  stateLabel = REVIEW_STATE_LABEL[state],
  stateTooltip,
  className: extraClassName,
}: {
  href?: string
  name: string
  email?: string
  stage?: ApplicationStage
  date?: string
  dateTooltip?: string
  state: ReviewState
  stateLabel?: string
  stateTooltip?: string
  className?: string
}) {
  const body = (
    <>
      <span
        className={`h-4 w-4 rounded-full border-2 ${REVIEW_STATE_DOT[state]}`}
      />

      <span className="text-text-default min-w-0 truncate text-sm font-medium">
        {name}
      </span>
      <span className="text-text-subtle hidden min-w-0 truncate text-xs sm:block">
        {email}
      </span>

      {stage && (
        <span className="hidden lg:block">
          <Badge className={stageBadge[stage]}>{stageLabel[stage]}</Badge>
        </span>
      )}

      <span className="text-text-subtle hidden text-xs sm:flex">
        {date && (
          <Tooltip label={dateTooltip}>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {shortDate(date)}
            </span>
          </Tooltip>
        )}
      </span>

      <span className="flex">
        <Tooltip label={stateTooltip ?? stateLabel}>
          <Badge className={REVIEW_STATE_BADGE[state]}>
            {state === 'submitted' && <CheckCircle2 className="h-3 w-3" />}
            {stateLabel}
          </Badge>
        </Tooltip>
      </span>

      {/* Same hover affordance as the applicant's apply card. */}
      <span className="text-text-faint group-hover:text-brand-blue flex items-center transition-colors">
        {href && (
          <ArrowRight
            size={16}
            className="transition-transform group-hover:translate-x-1"
          />
        )}
      </span>
    </>
  )

  const className = cn(
    'group grid items-center gap-3',
    stage ? GRID_WITH_STAGE : GRID,
    TABLE_ROW,
    extraClassName
  )

  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  )
}
