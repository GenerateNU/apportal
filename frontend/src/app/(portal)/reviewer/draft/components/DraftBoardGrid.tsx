'use client'

import { ArrowLeft, ArrowRight, Pencil, X } from 'lucide-react'
import { PersonCell } from '@/components/ui/person-cell'
import { SectionLabel } from '@/components/ui/section-label'
import type { DraftBoard } from '@/lib/api/types'
import {
  TABLE_CELL,
  TABLE_FRAME,
  TABLE_HEAD,
  TABLE_ROW,
} from '@/components/ui/table-styles'
import { cn } from '@/lib/utils'

const HEAD_CELL = cn(TABLE_HEAD, 'border-r border-r-gray-100 text-left')

// The board: one row per round, one column per team in order. Odd rounds run
// left to right, even rounds right to left — the arrow on each row says which,
// and it's why the team in the last column picks twice at the turn.
//
// Which slot a cell holds comes from board.slots rather than being derived
// from the snake here: after a chief reorders a live board, a pick already
// made stays with the team that made it, which the snake alone can't say.
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
  const slotByTeamRound = new Map(
    (board.slots ?? []).map((slot) => [
      `${slot.draft_team_id}:${Math.floor((slot.pick_number - 1) / teams.length) + 1}`,
      slot.pick_number,
    ])
  )

  return (
    <div className="flex flex-col gap-3">
      <SectionLabel>Board</SectionLabel>
      <div className={TABLE_FRAME}>
        <table className="w-full min-w-max border-collapse">
          <thead>
            <tr>
              <th className={cn(HEAD_CELL, 'w-14 sm:w-20')}>Round</th>
              {teams.map((team) => (
                <th
                  key={team.id}
                  className={cn(
                    HEAD_CELL,
                    'min-w-44 last:border-r-0 sm:min-w-56'
                  )}
                >
                  <span className="text-text-default block text-sm font-semibold">
                    {team.name}
                  </span>
                  {team.member_names.length > 0 && (
                    <span className="text-text-subtle mt-0.5 block truncate font-sans text-xs font-normal tracking-normal normal-case">
                      {team.member_names.join(', ')}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rounds.map((round) => (
              <tr key={round} className={TABLE_ROW}>
                <td
                  className={cn(
                    TABLE_CELL,
                    'text-text-subtle border-r border-gray-100 align-top text-xs'
                  )}
                >
                  <span className="inline-flex items-center gap-1 font-medium">
                    {round}
                    {round % 2 === 1 ? (
                      <ArrowRight size={11} />
                    ) : (
                      <ArrowLeft size={11} />
                    )}
                  </span>
                </td>
                {teams.map((team) => {
                  const slot = slotByTeamRound.get(`${team.id}:${round}`)
                  const pick = slot ? pickBySlot.get(slot) : undefined
                  const onTheClock = !!slot && board.on_the_clock === slot
                  if (!slot) {
                    return (
                      <td
                        key={team.id}
                        className="border-r border-gray-100 p-2 align-top last:border-r-0"
                      />
                    )
                  }
                  return (
                    <td
                      key={team.id}
                      className="border-r border-gray-100 p-2 align-top last:border-r-0"
                    >
                      <div
                        className={`group flex min-h-16 items-start gap-2.5 border px-3 py-2.5 ${
                          pick
                            ? 'border-gray-200 bg-white'
                            : onTheClock
                              ? 'border-brand-blue border-dashed bg-blue-50'
                              : 'border-gray-100 bg-gray-50/60'
                        }`}
                      >
                        {pick ? (
                          <>
                            <PersonCell
                              name={pick.full_name || pick.application_id}
                              secondary={`Pick #${slot}`}
                              className="flex-1"
                            />
                            {canEdit && (
                              <div className="flex shrink-0 items-center gap-1 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
                                {/* Hover-reveal only where hover exists; touch has no other way to see these. */}
                                <button
                                  type="button"
                                  onClick={() => onChangePick(slot)}
                                  aria-label={`Change pick ${slot}`}
                                  title="Change this pick"
                                  className="text-text-subtle hover:text-brand-blue p-0.5 transition-colors pointer-coarse:p-2"
                                >
                                  <Pencil size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onRemovePick(slot)}
                                  disabled={removingPick === slot}
                                  aria-label={`Undo pick ${slot}`}
                                  title="Undo this pick"
                                  className="text-text-subtle hover:text-destructive p-0.5 transition-colors disabled:opacity-40 pointer-coarse:p-2"
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
