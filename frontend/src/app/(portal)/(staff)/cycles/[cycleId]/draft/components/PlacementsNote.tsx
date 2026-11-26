import Link from 'next/link'
import { ArrowRight, Check, Lock } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { SectionLabel } from '@/components/ui/section-label'
import type { DraftBoard } from '@/lib/api/types'

export function PlacementsNote({
  board,
  href,
}: {
  board: DraftBoard
  href: string
}) {
  const total = (board.placement_rounds ?? 0) * board.teams.length
  const placed = board.picks.filter((p) => p.pick_number <= total).length
  const released = !!board.placements_released_at
  return (
    <Card
      padding="none"
      className="flex flex-wrap items-center justify-between gap-3 p-5"
    >
      <div className="flex flex-col gap-1">
        <SectionLabel>Placements</SectionLabel>
        <span className="text-text-muted inline-flex items-center gap-1.5 text-sm">
          {!board.placements_enabled ? (
            'Not used for this draft. Chiefs can place each team’s top 2 from Teams & preference lists.'
          ) : released ? (
            <>
              <Lock size={14} className="text-emerald-700" />
              {placed} of {total} placed · released to teams
            </>
          ) : (
            <>
              <Check size={14} />
              {placed} of {total} placed · not released yet
            </>
          )}
        </span>
      </div>
      <Link
        href={href}
        className="text-ink inline-flex items-center gap-1 text-sm font-medium hover:underline"
      >
        Teams & preference lists <ArrowRight size={14} />
      </Link>
    </Card>
  )
}
