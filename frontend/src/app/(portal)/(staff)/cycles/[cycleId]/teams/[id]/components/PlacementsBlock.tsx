import { Pin } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { DraftPickDetail, DraftTeamDetail } from '@/lib/api/types'
import { cn } from '@/lib/utils'

export type TeamPlacements = {
  team: DraftTeamDetail
  mine: boolean
  picks: DraftPickDetail[]
}

export function PlacementsBlock({
  placements,
}: {
  placements: TeamPlacements[]
}) {
  return (
    <section className="flex flex-col gap-3 border border-l-4 border-emerald-300 border-l-emerald-600 bg-emerald-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-display inline-flex items-center gap-2 text-sm tracking-wider text-emerald-900 uppercase">
          <Pin size={16} className="text-emerald-700" />
          Placements
        </span>
      </div>
      <ul className="max-h-64 overflow-y-auto border border-emerald-200 bg-white">
        {placements.map(({ team, mine, picks }) => (
          <li
            key={team.id}
            className={cn(
              'flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 text-sm not-first:border-t not-first:border-gray-100',
              mine && 'sticky top-0 z-10 bg-emerald-100/70'
            )}
          >
            <span
              className="text-ink flex w-56 shrink-0 items-center gap-2 font-medium"
              title={team.name}
            >
              <span className="truncate">{team.name}</span>
              {mine && (
                <Badge size="sm" className="shrink-0 bg-emerald-600 text-white">
                  Your team
                </Badge>
              )}
            </span>
            <span
              className={cn(
                'min-w-0 flex-1',
                picks.length === 0
                  ? 'text-text-subtle'
                  : mine
                    ? 'text-ink font-semibold'
                    : 'text-ink'
              )}
            >
              {picks.length === 0
                ? 'No one placed'
                : picks.map((p) => p.full_name).join(', ')}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
