'use client'

import { ArrowLeft, ArrowRight, Pencil, X } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import type { DraftBoard } from '@/lib/api/types'
import { SECTION_HEADER_CLASS } from './constants'

// The board: one row per round, one column per team in order. Odd rounds run
// left to right, even rounds right to left — the arrow on each row says which,
// and it's why the team in the last column picks twice at the turn.
export function DraftBoardGrid({
  board,
  canEdit,
  onChangePick,
  onRemovePick,
  removingPick,
}: {
  board: DraftBoard
  canEdit: boolean
  // Swap who's in a slot that's already filled, without reopening it.
  onChangePick: (pickNumber: number) => void
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
    <div className="flex flex-col gap-3">
      <h2 className={SECTION_HEADER_CLASS}>Board</h2>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-max border-collapse">
          <thead>
            <tr>
              <th className="text-text-muted w-20 border-r border-b border-gray-100 bg-gray-50 px-4 py-3 text-left text-xs font-medium">
                Round
              </th>
              {teams.map((team) => (
                <th
                  key={team.id}
                  className="min-w-56 border-r border-b border-gray-100 bg-gray-50 px-4 py-3 text-left last:border-r-0"
                >
                  <span className="text-text-default block text-sm font-semibold">
                    {team.name}
                  </span>
                  {team.member_names.length > 0 && (
                    <span className="text-text-subtle mt-0.5 block truncate text-xs font-normal">
                      {team.member_names.join(', ')}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rounds.map((round) => (
              <tr
                key={round}
                className="border-b border-gray-100 last:border-b-0"
              >
                <td className="text-text-subtle border-r border-gray-100 px-4 py-3 align-top text-xs">
                  <span className="inline-flex items-center gap-1 font-medium">
                    {round}
                    {round % 2 === 1 ? (
                      <ArrowRight size={11} />
                    ) : (
                      <ArrowLeft size={11} />
                    )}
                  </span>
                </td>
                {teams.map((_, seat) => {
                  // Which slot this cell holds is the snake run backwards: the
                  // pick number in this round that lands on this seat.
                  const slot =
                    (round - 1) * teams.length +
                    (round % 2 === 1 ? seat : teams.length - 1 - seat) +
                    1
                  const pick = pickBySlot.get(slot)
                  const onTheClock = board.on_the_clock === slot
                  return (
                    <td
                      key={seat}
                      className="border-r border-gray-100 p-2 align-top last:border-r-0"
                    >
                      <div
                        className={`group flex min-h-16 items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-shadow ${
                          pick
                            ? 'border-gray-200 bg-white shadow-sm hover:shadow-md'
                            : onTheClock
                              ? 'border-brand-blue border-dashed bg-blue-50'
                              : 'border-gray-100 bg-gray-50/60'
                        }`}
                      >
                        {pick ? (
                          <>
                            <Avatar name={pick.full_name} size="sm" />
                            <div className="min-w-0 flex-1">
                              <span className="text-text-default block truncate text-sm font-medium">
                                {pick.full_name || pick.application_id}
                              </span>
                              <span className="text-text-subtle block text-xs">
                                Pick #{slot}
                              </span>
                            </div>
                            {canEdit && (
                              <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                <button
                                  type="button"
                                  onClick={() => onChangePick(slot)}
                                  aria-label={`Change pick ${slot}`}
                                  title="Change this pick"
                                  className="text-text-subtle hover:text-brand-blue rounded p-0.5 transition-colors"
                                >
                                  <Pencil size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onRemovePick(slot)}
                                  disabled={removingPick === slot}
                                  aria-label={`Undo pick ${slot}`}
                                  title="Undo this pick"
                                  className="text-text-subtle hover:text-destructive rounded p-0.5 transition-colors disabled:opacity-40"
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex flex-1 flex-col justify-center">
                            <span
                              className={`text-sm ${
                                onTheClock
                                  ? 'text-brand-blue font-semibold'
                                  : 'text-text-subtle'
                              }`}
                            >
                              {onTheClock ? 'On the clock' : 'Open'}
                            </span>
                            <span className="text-text-subtle text-xs">
                              Pick #{slot}
                            </span>
                          </div>
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
    </div>
  )
}
