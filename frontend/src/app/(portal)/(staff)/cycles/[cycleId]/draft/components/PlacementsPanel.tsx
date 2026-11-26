'use client'

import { useMemo } from 'react'
import { Check, Loader2, Lock, Undo2, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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
  board,
  lists,
  pool,
  orderUnsaved,
  onToggle,
  onPlace,
  onRemove,
  onRelease,
  toggling,
  placing,
  releasing,
}: {
  board: DraftBoard
  lists: PreferenceListDetail[]
  pool: ApplicationSummary[]
  orderUnsaved: boolean
  onToggle: (enabled: boolean) => void
  onPlace: (slot: number, applicationId: string, name: string) => void
  onRemove: (slot: number) => void
  onRelease: (released: boolean) => void
  toggling: boolean
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

  const topTwoTeams = useMemo(() => {
    const out = new Map<string, string[]>()
    for (const team of board.teams) {
      for (const r of (rankedByList.get(team.preference_list_id) ?? []).slice(
        0,
        PLACED_PER_TEAM
      )) {
        out.set(r.applicationId, [...(out.get(r.applicationId) ?? []), team.id])
      }
    }
    return out
  }, [board.teams, rankedByList])

  const takenBy = new Map(board.picks.map((p) => [p.application_id, p]))
  const teamName = new Map(board.teams.map((t) => [t.id, t.name]))
  const available = pool
    .filter((a) => a.stage === 'selection' && !takenBy.has(a.id))
    .sort((a, b) =>
      (a.full_name || a.user_nuid).localeCompare(b.full_name || b.user_nuid)
    )

  return (
    <Card padding="none" className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <SectionLabel>Place top picks first</SectionLabel>
          <label className="text-ink flex items-center gap-2 text-sm">
            <Checkbox
              checked={enabled}
              disabled={
                toggling || released || (enabled && placedPicks.length > 0)
              }
              onCheckedChange={(v) => onToggle(v === true)}
            />
            Chiefs place {PLACED_PER_TEAM} applicants on every team before
            picking starts
          </label>
          {enabled && placedPicks.length > 0 && !released && (
            <span className="text-text-subtle text-xs">
              Remove the placements to turn this off.
            </span>
          )}
        </div>
        {enabled && (
          <PlacementStatus
            placed={placedPicks.length}
            total={placementSlots}
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
                        (topTwoTeams.get(r.applicationId) ?? []).length > 1
                    )
                  if (ties.length === 0) return null
                  return (
                    <p className="text-xs text-amber-700">
                      Tie:{' '}
                      {ties
                        .map(
                          (r) =>
                            `${r.name} is also top ${PLACED_PER_TEAM} for ${(
                              topTwoTeams.get(r.applicationId) ?? []
                            )
                              .filter((id) => id !== team.id)
                              .map((id) => teamName.get(id))
                              .join(', ')}`
                        )
                        .join('; ')}
                    </p>
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

function PlacementStatus({
  placed,
  total,
  released,
  releasing,
  onRelease,
}: {
  placed: number
  total: number
  released: boolean
  releasing: boolean
  onRelease: (released: boolean) => void
}) {
  if (released) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700">
          <Lock size={14} />
          Released to teams
        </span>
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
  const ready = total > 0 && placed === total
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          'text-sm tabular-nums',
          ready ? 'text-ink' : 'text-text-muted'
        )}
      >
        {placed} of {total} placed
      </span>
      <Button disabled={!ready || releasing} onClick={() => onRelease(true)}>
        {releasing && <Loader2 className="animate-spin" size={14} />}
        Release to teams
      </Button>
    </div>
  )
}
