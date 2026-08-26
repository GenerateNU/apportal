'use client'

import { ArrowRight, Loader2 } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/searchable-select'
import type {
  ApplicationSummary,
  DraftBoard,
  PreferenceListDetail,
} from '@/lib/api/types'
import { SECTION_HEADER_CLASS } from './constants'
import { roundOf } from './snake'

// What the operator actually drives during the draft: whose turn it is, that
// team's own ranked list to pick down, and a search over the rest of the pool
// for when they go off-list. Given top billing on the page because it's the
// one thing a room full of people is looking at.
export function OnTheClockPanel({
  board,
  teamList,
  pool,
  takenByApplicationId,
  canPick,
  onPick,
  picking,
  error,
}: {
  board: DraftBoard
  // The on-the-clock team's preference list, once it's loaded.
  teamList?: PreferenceListDetail
  pool: ApplicationSummary[]
  // Application id -> the team that already took them, across every board.
  takenByApplicationId: Record<string, string>
  // Only the operator picks; everyone else is following along.
  canPick: boolean
  onPick: (applicationId: string) => void
  picking: boolean
  error?: string
}) {
  const team = board.teams.find((t) => t.id === board.on_the_clock_team_id)
  if (!board.on_the_clock || !team) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className={SECTION_HEADER_CLASS}>On the clock</h2>
        <p className="text-text-muted text-sm">
          {board.status === 'complete'
            ? 'This draft is complete.'
            : board.picks.length >= board.rounds * board.teams.length
              ? 'Every slot is filled — add a round to keep going.'
              : 'Nothing is on the clock.'}
        </p>
      </div>
    )
  }

  const round = roundOf(board.on_the_clock, board.teams.length)
  // Entries for this board's role only; the group ranks every role in one list.
  const entries = (teamList?.entries ?? [])
    .filter((e) => e.application_role === board.application_role)
    .sort((a, b) => a.rank - b.rank)
  const available = pool.filter((a) => !takenByApplicationId[a.id])

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* The brand-blue band is the page's focal point — from across a room
          it's the only thing that has to be legible. */}
      <div className="bg-brand-blue text-brand-white flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-white/20 px-2 py-0.5 text-xs font-semibold tracking-wide uppercase">
            On the clock
          </span>
          <div>
            <p className="text-xl leading-tight font-semibold">{team.name}</p>
            <p className="text-xs text-white/80">
              Round {round} · Pick #{board.on_the_clock}
              {team.member_names.length > 0 &&
                ` · ${team.member_names.join(', ')}`}
            </p>
          </div>
        </div>
        {canPick && (
          <SearchableSelect
            options={available.map((a) => ({
              value: a.id,
              label: a.full_name || a.user_nuid,
            }))}
            onValueChange={onPick}
            placeholder="Pick someone else…"
            searchPlaceholder="Search applicants…"
            emptyText="No applicants left."
            className="w-72 bg-white"
            ariaLabel="Pick an applicant not on this team's list"
          />
        )}
      </div>

      <div className="flex flex-col gap-3 p-5">
        {error && <p className="text-destructive text-sm">{error}</p>}
        <h3 className={SECTION_HEADER_CLASS}>{team.name}&apos;s list</h3>
        {entries.length === 0 ? (
          <p className="text-text-muted text-sm">
            This group hasn&apos;t ranked anyone for this role.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {entries.map((entry) => {
              const takenBy = takenByApplicationId[entry.application_id]
              return (
                <li
                  key={entry.id}
                  className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-shadow ${
                    takenBy
                      ? 'border-gray-100 bg-gray-50/60'
                      : 'border-gray-200 bg-white shadow-sm hover:shadow-md'
                  }`}
                >
                  <span className="text-text-subtle w-5 shrink-0 text-center text-sm font-semibold">
                    {entry.rank}
                  </span>
                  <Avatar name={entry.full_name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-sm font-medium ${
                        takenBy
                          ? 'text-text-subtle line-through'
                          : 'text-text-default'
                      }`}
                    >
                      {entry.full_name}
                    </span>
                    <span className="text-text-subtle block truncate text-xs">
                      {entry.email}
                    </span>
                  </div>
                  {takenBy ? (
                    <span className="text-text-muted shrink-0 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium">
                      Drafted · {takenBy}
                    </span>
                  ) : (
                    canPick && (
                      <Button
                        size="sm"
                        onClick={() => onPick(entry.application_id)}
                        disabled={picking}
                        className="shrink-0"
                      >
                        {picking ? (
                          <Loader2 className="animate-spin" size={13} />
                        ) : (
                          <ArrowRight
                            size={13}
                            className="transition-transform group-hover:translate-x-0.5"
                          />
                        )}
                        Pick
                      </Button>
                    )
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </div>
  )
}
