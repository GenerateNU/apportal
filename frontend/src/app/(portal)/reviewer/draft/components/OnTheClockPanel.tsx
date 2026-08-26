'use client'

import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/searchable-select'
import type {
  ApplicationSummary,
  DraftBoard,
  PreferenceListDetail,
} from '@/lib/api/types'
import { roundOf } from './snake'

// What the operator actually drives during the draft: whose turn it is, that
// team's own ranked list to pick down, and a search over the rest of the pool
// for when they go off-list.
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
      <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm shadow-sm">
        <p className="text-text-muted">
          {board.status === 'complete'
            ? 'This draft is complete.'
            : board.picks.length >= board.rounds * board.teams.length
              ? 'Every slot is filled — raise the round count to keep going.'
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
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-text-faint text-xs font-semibold tracking-wide uppercase">
            Round {round} · Pick #{board.on_the_clock}
          </p>
          <h2 className="text-text-default text-xl font-semibold">
            {team.name}
          </h2>
          {team.member_names.length > 0 && (
            <p className="text-text-muted text-xs">
              {team.member_names.join(', ')}
            </p>
          )}
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
            className="w-72"
            ariaLabel="Pick an applicant not on this team's list"
          />
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div>
        <p className="text-text-muted mb-2 text-xs font-medium">
          {team.name}&apos;s list
        </p>
        {entries.length === 0 ? (
          <p className="text-text-faint text-sm">
            This group hasn&apos;t ranked anyone for this role.
          </p>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {entries.map((entry) => {
              const takenBy = takenByApplicationId[entry.application_id]
              return (
                <li
                  key={entry.id}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                    takenBy
                      ? 'border-gray-100 bg-gray-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <span className="text-text-subtle w-6 text-sm font-semibold">
                    {entry.rank}
                  </span>
                  <span
                    className={`flex-1 truncate text-sm ${
                      takenBy
                        ? 'text-text-faint line-through'
                        : 'text-text-default font-medium'
                    }`}
                  >
                    {entry.full_name}
                  </span>
                  {takenBy ? (
                    <span className="text-text-faint shrink-0 rounded-md bg-gray-100 px-2 py-0.5 text-xs">
                      Taken · {takenBy}
                    </span>
                  ) : (
                    canPick && (
                      <Button
                        size="sm"
                        onClick={() => onPick(entry.application_id)}
                        disabled={picking}
                      >
                        {picking && (
                          <Loader2 className="animate-spin" size={13} />
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
