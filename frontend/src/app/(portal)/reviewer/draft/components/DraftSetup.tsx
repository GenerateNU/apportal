'use client'

import { ArrowDown, ArrowUp, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import type { DraftBoard, PreferenceListSummary } from '@/lib/api/types'

// The order editor, shown while the draft is still in setup. Seats are
// preference list groups; everything about the board — who picks when, whose
// ranked list is on screen — follows from this order, so it's frozen the
// moment picking starts.
export function DraftSetup({
  board,
  groups,
  order,
  rounds,
  onToggle,
  onMove,
  onRoundsChange,
  onSave,
  onStart,
  saving,
  starting,
}: {
  board: DraftBoard
  groups: PreferenceListSummary[]
  // Preference list ids, in pick order.
  order: string[]
  rounds: number
  onToggle: (id: string) => void
  onMove: (index: number, direction: -1 | 1) => void
  onRoundsChange: (rounds: number) => void
  onSave: () => void
  onStart: () => void
  saving: boolean
  starting: boolean
}) {
  const nameById = new Map(groups.map((g) => [g.id, g.name]))
  const unselected = groups.filter((g) => !order.includes(g.id))
  const totalPicks = order.length * rounds

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-text-faint text-xs font-semibold tracking-wide uppercase">
          Draft order
        </h2>
        {order.length === 0 ? (
          <p className="text-text-faint text-sm">
            Add the groups drafting this role, then put them in the order they
            pick.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {order.map((id, index) => (
              <li
                key={id}
                className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2"
              >
                <span className="text-text-subtle w-6 text-sm font-semibold">
                  {index + 1}
                </span>
                <span className="text-text-default flex-1 text-sm font-medium">
                  {nameById.get(id) ?? id}
                </span>
                <button
                  type="button"
                  onClick={() => onMove(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${nameById.get(id) ?? id} up`}
                  className="text-text-faint hover:text-text-muted disabled:opacity-30"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => onMove(index, 1)}
                  disabled={index === order.length - 1}
                  aria-label={`Move ${nameById.get(id) ?? id} down`}
                  className="text-text-faint hover:text-text-muted disabled:opacity-30"
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => onToggle(id)}
                  className="text-text-faint hover:text-text-muted text-xs"
                >
                  Remove
                </button>
              </li>
            ))}
          </ol>
        )}

        {unselected.length > 0 && (
          <div className="border-t border-gray-100 pt-3">
            <p className="text-text-muted mb-2 text-xs font-medium">
              Groups not in the draft
            </p>
            <div className="flex flex-col gap-2">
              {unselected.map((g) => (
                <label
                  key={g.id}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={false}
                    onCheckedChange={() => onToggle(g.id)}
                  />
                  <span className="text-text-default">{g.name}</span>
                  <span className="text-text-faint text-xs">
                    {g.member_count} members
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-5 text-sm shadow-sm">
        <label htmlFor="draft-rounds" className="text-text-muted font-medium">
          Rounds
        </label>
        <Input
          id="draft-rounds"
          type="number"
          min={1}
          value={rounds}
          onChange={(e) => onRoundsChange(Number(e.target.value))}
          className="h-9 w-24"
        />
        <span className="text-text-faint text-xs">
          {order.length} teams × {rounds} rounds = {totalPicks} picks
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={onSave} disabled={saving}>
          {saving && <Loader2 className="animate-spin" size={14} />}
          Save order
        </Button>
        <Button
          onClick={onStart}
          disabled={starting || board.teams.length === 0}
          title={board.teams.length === 0 ? 'Save the order first' : undefined}
        >
          {starting && <Loader2 className="animate-spin" size={14} />}
          Start draft
        </Button>
      </div>
    </div>
  )
}
