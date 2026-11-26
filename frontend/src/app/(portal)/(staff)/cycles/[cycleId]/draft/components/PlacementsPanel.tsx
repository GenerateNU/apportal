'use client'

import { useMemo, useState } from 'react'
import {
  Check,
  Loader2,
  Lock,
  TriangleAlert,
  Undo2,
  Users,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { SectionLabel } from '@/components/ui/section-label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {
  ApplicationSummary,
  DraftBoard,
  PreferenceListDetail,
} from '@/lib/api/types'
import { cn } from '@/lib/utils'

const PLACED_PER_TEAM = 2

type Ranked = { applicationId: string; name: string; rank: number }

export function PlacementsPanel({
  title = 'Place top picks first',
  embedded = false,
  board,
  lists,
  pool,
  orderUnsaved,
  onPlace,
  onRemove,
  onRelease,
  placing,
  releasing,
}: {
  title?: string
  embedded?: boolean
  board: DraftBoard
  lists: PreferenceListDetail[]
  pool: ApplicationSummary[]
  orderUnsaved: boolean
  onPlace: (slot: number, applicationId: string, name: string) => void
  onRemove: (slot: number) => void
  onRelease: (released: boolean) => void
  placing: boolean
  releasing: boolean
}) {
  const enabled = board.placements_enabled
  const released = !!board.placements_released_at
  const teamCount = board.teams.length
  const placementSlots = (board.placement_rounds ?? 0) * teamCount
  const placedPicks = board.picks.filter((p) => p.pick_number <= placementSlots)
  const locked = released || orderUnsaved

  const rankedByList = useMemo(() => {
    const out = new Map<string, Ranked[]>()
    for (const l of lists) {
      out.set(
        l.id,
        (l.entries ?? [])
          .filter((e) => e.role_id === board.role_id)
          .sort((a, b) => a.rank - b.rank)
          .map((e, i) => ({
            applicationId: e.application_id,
            name: e.full_name,
            rank: i + 1,
          }))
      )
    }
    return out
  }, [lists, board.role_id])

  const topTwo = useMemo(() => {
    const out = new Map<string, { teamId: string; rank: number }[]>()
    for (const team of board.teams) {
      for (const r of (rankedByList.get(team.preference_list_id) ?? []).slice(
        0,
        PLACED_PER_TEAM
      )) {
        out.set(r.applicationId, [
          ...(out.get(r.applicationId) ?? []),
          { teamId: team.id, rank: r.rank },
        ])
      }
    }
    return out
  }, [board.teams, rankedByList])
  const topTwoTeams = useMemo(
    () =>
      new Map(
        [...topTwo].map(([id, wants]) => [id, wants.map((w) => w.teamId)])
      ),
    [topTwo]
  )

  const takenBy = new Map(board.picks.map((p) => [p.application_id, p]))
  const teamName = new Map(board.teams.map((t) => [t.id, t.name]))
  const available = pool
    .filter((a) => a.stage === 'selection' && !takenBy.has(a.id))
    .sort((a, b) =>
      (a.full_name || a.user_nuid).localeCompare(b.full_name || b.user_nuid)
    )

  return (
    <Card
      padding="none"
      className={cn(
        'flex flex-col gap-4',
        embedded ? 'border-0 bg-transparent p-0 shadow-none' : 'p-5'
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          {!embedded && <SectionLabel>{title}</SectionLabel>}
        </div>
        {enabled && !embedded && (
          <PlacementReleaseControl
            teamCount={teamCount}
            ready={placementSlots > 0 && placedPicks.length === placementSlots}
            summary={`${board.teams.filter((t) => placedPicks.filter((p) => p.draft_team_id === t.id).length >= (board.placement_rounds ?? 0)).length}/${teamCount} teams`}
            released={released}
            releasing={releasing}
            onRelease={onRelease}
          />
        )}
      </div>

      {enabled && orderUnsaved && (
        <p className="text-text-muted border border-dashed border-gray-300 px-3 py-2 text-sm">
          Save the draft order first, so each team&apos;s placement slots line
          up.
        </p>
      )}

      {enabled && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {board.teams.map((team) => {
            const slots = (board.slots ?? [])
              .filter(
                (s) =>
                  s.pick_number <= placementSlots && s.draft_team_id === team.id
              )
              .sort((a, b) => a.pick_number - b.pick_number)
            const ranked = rankedByList.get(team.preference_list_id) ?? []
            const rankOf = new Map(ranked.map((r) => [r.applicationId, r.rank]))
            return (
              <div
                key={team.id}
                className="flex flex-col gap-2 border border-gray-200 bg-white p-3"
              >
                <span className="text-ink flex items-center gap-2 text-sm font-semibold">
                  <Users size={14} className="text-text-muted" />
                  {team.name}
                </span>
                {slots.map((slot) => {
                  const pick = board.picks.find(
                    (p) => p.pick_number === slot.pick_number
                  )
                  if (pick) {
                    const rank = rankOf.get(pick.application_id)
                    return (
                      <div
                        key={slot.pick_number}
                        className="flex items-center gap-2 border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm"
                      >
                        <Check
                          size={14}
                          className="shrink-0 text-emerald-600"
                        />
                        <span className="text-ink min-w-0 flex-1 truncate">
                          {pick.full_name}
                        </span>
                        {rank !== undefined && (
                          <span className="text-text-muted shrink-0 text-xs tabular-nums">
                            #{rank} on their list
                          </span>
                        )}
                        {!locked && (
                          <button
                            type="button"
                            aria-label={`Remove ${pick.full_name}`}
                            disabled={placing}
                            onClick={() => onRemove(slot.pick_number)}
                            className="text-text-muted hover:text-ink shrink-0"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    )
                  }
                  const ownTop = ranked.filter(
                    (r) => !takenBy.has(r.applicationId)
                  )
                  const ownIds = new Set(ownTop.map((r) => r.applicationId))
                  const others = available.filter((a) => !ownIds.has(a.id))
                  return (
                    <Select
                      key={slot.pick_number}
                      value=""
                      disabled={locked || placing}
                      onValueChange={(id) => {
                        const name =
                          ownTop.find((r) => r.applicationId === id)?.name ??
                          available.find((a) => a.id === id)?.full_name ??
                          ''
                        onPlace(slot.pick_number, id, name)
                      }}
                    >
                      <SelectTrigger
                        className="h-9 w-full"
                        aria-label={`Place someone on ${team.name}`}
                      >
                        <SelectValue placeholder="Place someone…" />
                      </SelectTrigger>
                      <SelectContent>
                        {ownTop.length > 0 && (
                          <SelectGroup>
                            <SelectLabel>
                              {team.name}&apos;s ranking
                            </SelectLabel>
                            {ownTop.map((r) => {
                              const contested = (
                                topTwoTeams.get(r.applicationId) ?? []
                              ).filter((id) => id !== team.id)
                              return (
                                <SelectItem
                                  key={r.applicationId}
                                  value={r.applicationId}
                                >
                                  <span className="tabular-nums">
                                    #{r.rank}
                                  </span>{' '}
                                  {r.name}
                                  {contested.length > 0 && (
                                    <span className="ml-1.5 text-xs text-amber-700">
                                      also top {PLACED_PER_TEAM} for{' '}
                                      {contested
                                        .map((id) => teamName.get(id))
                                        .join(', ')}
                                    </span>
                                  )}
                                </SelectItem>
                              )
                            })}
                          </SelectGroup>
                        )}
                        {others.length > 0 && (
                          <SelectGroup>
                            <SelectLabel>Everyone else</SelectLabel>
                            {others.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.full_name || a.user_nuid}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                      </SelectContent>
                    </Select>
                  )
                })}
                {(() => {
                  const ties = ranked
                    .slice(0, PLACED_PER_TEAM)
                    .filter(
                      (r) =>
                        !takenBy.has(r.applicationId) &&
                        (topTwo.get(r.applicationId) ?? []).length > 1
                    )
                  if (ties.length === 0) return null
                  return (
                    <div className="flex flex-col gap-1.5 border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs">
                      <span className="inline-flex items-center gap-1.5 font-medium text-amber-800">
                        <TriangleAlert size={12} />
                        Also in other teams&apos; top {PLACED_PER_TEAM}
                      </span>
                      <ul className="flex flex-col gap-1">
                        {ties.map((r) => {
                          const wants = [
                            ...(topTwo.get(r.applicationId) ?? []),
                          ].sort((x, y) =>
                            x.teamId === team.id
                              ? -1
                              : y.teamId === team.id
                                ? 1
                                : x.rank - y.rank
                          )
                          return (
                            <li
                              key={r.applicationId}
                              className="flex flex-wrap items-center gap-x-2 gap-y-0.5"
                            >
                              <span className="text-ink min-w-24 font-medium">
                                {r.name}
                              </span>
                              {wants.map((w) => (
                                <span
                                  key={w.teamId}
                                  className={cn(
                                    'tabular-nums',
                                    w.teamId === team.id
                                      ? 'text-ink'
                                      : 'text-amber-800'
                                  )}
                                >
                                  {teamName.get(w.teamId)} #{w.rank}
                                </span>
                              ))}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )
                })()}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

export function PlacementReleaseControl({
  teamCount,
  ready,
  summary,
  released,
  releasing,
  onRelease,
  compact = false,
}: {
  compact?: boolean
  teamCount: number
  ready: boolean
  summary?: string
  released: boolean
  releasing: boolean
  onRelease: (released: boolean) => void
}) {
  const [confirming, setConfirming] = useState(false)
  if (released) {
    return (
      <div className="flex items-center gap-2">
        {!compact && (
          <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700">
            <Lock size={14} />
            Released to teams
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={releasing}
          onClick={() => onRelease(false)}
        >
          <Undo2 />
          Take back
        </Button>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-3">
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Release placements to all teams?"
        description={`All ${teamCount} teams will see who was placed on them. Placements are locked until you take them back, and the draft can start once they're out.`}
        confirmLabel="Release to teams"
        confirmVariant="default"
        pending={releasing}
        onConfirm={() => {
          onRelease(true)
          setConfirming(false)
        }}
      />
      {!compact && summary && (
        <span
          className={cn(
            'text-sm tabular-nums',
            ready ? 'text-ink' : 'text-text-muted'
          )}
        >
          {summary}
        </span>
      )}
      <Button
        disabled={!ready || releasing}
        onClick={() => setConfirming(true)}
      >
        {releasing && <Loader2 className="animate-spin" size={14} />}
        Release to teams
      </Button>
    </div>
  )
}
