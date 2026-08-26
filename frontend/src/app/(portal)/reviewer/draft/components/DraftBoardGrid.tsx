'use client'

import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import type { DraftBoard } from '@/lib/api/types'
import { snakeSeat } from './snake'

// The board: one row per round, one column per team in order. Odd rounds run
// left to right, even rounds right to left — the arrow on each row says which,
// and it's why the team in the last column picks twice at the turn.
export function DraftBoardGrid({
  board,
  canEdit,
  onRemovePick,
  removingPick,
}: {
  board: DraftBoard
  canEdit: boolean
  onRemovePick: (pickNumber: number) => void
  removingPick: number | null
}) {
  const teams = board.teams
  if (teams.length === 0) {
    return (
      <p className="text-text-faint text-sm">No teams in this draft yet.</p>
    )
  }
  const pickBySlot = new Map(board.picks.map((p) => [p.pick_number, p]))
  const rounds = Array.from({ length: board.rounds }, (_, i) => i + 1)

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full min-w-max border-collapse">
        <thead>
          <tr className="bg-gray-50">
            <th className="text-text-muted w-24 border-r border-b border-gray-100 px-3 py-2 text-left text-xs font-medium">
              Round
            </th>
            {teams.map((team) => (
              <th
                key={team.id}
                className="text-text-default min-w-52 border-r border-b border-gray-100 px-3 py-2 text-left text-xs font-semibold last:border-r-0"
              >
                {team.name}
                {team.member_names.length > 0 && (
                  <span className="text-text-faint block truncate text-[11px] font-normal">
                    {team.member_names.join(', ')}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rounds.map((round) => (
            <tr key={round} className="border-b border-gray-100">
              <td className="text-text-muted border-r border-gray-100 px-3 py-2 align-top text-xs">
                <span className="inline-flex items-center gap-1">
                  {round}
                  {round % 2 === 1 ? (
                    <ArrowRight size={11} />
                  ) : (
                    <ArrowLeft size={11} />
                  )}
                </span>
              </td>
              {teams.map((_, seat) => {
                // Which slot this cell holds is the snake formula run
                // backwards: find the pick number in this round that lands on
                // this seat.
                const slot =
                  (round - 1) * teams.length +
                  (round % 2 === 1 ? seat : teams.length - 1 - seat) +
                  1
                const pick = pickBySlot.get(slot)
                const onTheClock = board.on_the_clock === slot
                return (
                  <td
                    key={seat}
                    className={`border-r border-gray-100 px-3 py-2 align-top last:border-r-0 ${
                      onTheClock ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-text-faint block text-[11px]">
                          #{slot}
                        </span>
                        {pick ? (
                          <span className="text-text-default block truncate text-sm font-medium">
                            {pick.full_name || pick.application_id}
                          </span>
                        ) : (
                          <span
                            className={`block text-sm ${
                              onTheClock
                                ? 'text-brand-blue font-medium'
                                : 'text-text-faint'
                            }`}
                          >
                            {onTheClock ? 'On the clock' : '—'}
                          </span>
                        )}
                      </div>
                      {pick && canEdit && (
                        <button
                          type="button"
                          onClick={() => onRemovePick(slot)}
                          disabled={removingPick === slot}
                          aria-label={`Undo pick ${slot}`}
                          className="text-text-faint hover:text-text-muted shrink-0 disabled:opacity-40"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Re-exported for the on-the-clock header, which needs the same mapping.
export { snakeSeat }
