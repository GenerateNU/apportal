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

// One application in the lead's queue. A lead carries 25–30 of these, and the
// only things that vary between them are a name and how far along it is — so
// this is one scannable line rather than a card, and the whole line is the
// link. Progress is carried twice on purpose: a dot anchors the left edge for
// scanning straight down the column, and a labelled badge on the right says it
// in words — which is also what keeps the state legible without relying on the
// dot's colour. Secondary columns drop away on narrow screens; those two and
// the name never do.
export function ReviewRow({
  application,
  state,
  submittedAt,
}: {
  application: ApplicationSummary
  // How far this lead's own review of it has got.
  state: ReviewState
  // When they submitted it, if they have.
  submittedAt?: string
}) {
  return (
    <Link
      href={`/reviewer/my-reviews/${application.id}`}
      className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-gray-50"
    >
      <span
        className={`h-4 w-4 shrink-0 rounded-full border-2 ${REVIEW_STATE_DOT[state]}`}
      />

      <span className="text-text-default min-w-0 flex-1 truncate text-sm font-medium">
        {application.full_name || application.user_nuid}
      </span>
      <span className="text-text-subtle hidden min-w-0 flex-1 truncate text-xs sm:block">
        {application.email || application.user_nuid}
      </span>

      <span
        className={`hidden shrink-0 rounded-md px-2 py-0.5 text-xs font-medium md:inline-block ${stageBadge[application.stage]}`}
      >
        {stageLabel[application.stage]}
      </span>

      <span className="text-text-subtle hidden w-14 shrink-0 justify-end text-xs sm:flex">
        {application.submitted_at && (
          <Tooltip label="Application submitted">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {shortDate(application.submitted_at)}
            </span>
          </Tooltip>
        )}
      </span>

      {/* Fixed width whatever the state, so the badges line up down the list
          and the chevrons stay in one column. */}
      <span className="flex w-24 shrink-0 justify-end">
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

      {/* Same affordance as the applicant's apply card: the arrow warms to
          brand blue and slides on hover, so the row reads as something you
          open rather than a static line of data. The status icon on the left
          deliberately stays put — it reports state, it isn't a control. */}
      <span className="text-text-faint group-hover:text-brand-blue flex shrink-0 items-center transition-colors">
        <ArrowRight
          size={16}
          className="transition-transform group-hover:translate-x-1"
        />
      </span>
    </Link>
  )
}
