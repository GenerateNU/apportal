'use client'

import { AlertTriangle } from 'lucide-react'
import { Tooltip } from '@/components/Tooltip'
import { CHIEF_VOTE_BY_VALUE, isSplit } from '@/lib/chief-votes'
import type { ChiefReview } from '@/lib/queries/chief-reviews'
import { useCycleStaff } from '@/lib/queries/cycle-staff'
import { cn } from '@/lib/utils'

export function useCycleChiefNuids(cycleId: string) {
  const { data: staff = [] } = useCycleStaff(cycleId)
  return staff.filter((s) => s.role === 'chief').map((s) => s.user_nuid)
}

export function ChiefVoteSummary({
  reviews,
  chiefNuids,
  showSplit = true,
}: {
  reviews: ChiefReview[]
  chiefNuids: string[]
  showSplit?: boolean
}) {
  const voted = reviews.filter((r) => r.vote)
  const voters = new Set(voted.map((r) => r.reviewer_nuid))
  const total = new Set([...chiefNuids, ...voters]).size
  const missing = Math.max(total - voted.length, 0)
  const split = isSplit(voted.map((r) => r.vote))

  const label =
    voted.length === 0 ? (
      'No chief votes yet'
    ) : (
      <span className="flex flex-col gap-0.5 text-left">
        {voted.map((r) => (
          <span key={r.reviewer_nuid}>
            {r.reviewer_name || r.reviewer_nuid}:{' '}
            {CHIEF_VOTE_BY_VALUE.get(r.vote!)?.label}
          </span>
        ))}
      </span>
    )

  return (
    <span className="inline-flex items-center gap-2">
      <Tooltip label={label}>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex items-center gap-0.5">
            {voted.map((r) => (
              <span
                key={r.reviewer_nuid}
                className={cn(
                  'size-2.5 rounded-full',
                  CHIEF_VOTE_BY_VALUE.get(r.vote!)?.dot
                )}
              />
            ))}
            {Array.from({ length: missing }, (_, i) => (
              <span
                key={`m${i}`}
                className="size-2.5 rounded-full border border-gray-300"
              />
            ))}
          </span>
          <span className="text-text-muted text-xs tabular-nums">
            {voted.length}/{total}
          </span>
        </span>
      </Tooltip>
      {showSplit && split && (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
          <AlertTriangle size={12} />
          Split
        </span>
      )}
    </span>
  )
}
