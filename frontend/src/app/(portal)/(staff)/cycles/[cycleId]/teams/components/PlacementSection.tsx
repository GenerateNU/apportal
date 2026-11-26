'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCycleHref } from '@/hooks/useCycleHref'
import type { DraftBoard } from '@/lib/api/types'
import {
  useDraftBoard,
  useOpenDraft,
  useSetPlacementsReleased,
} from '@/lib/queries/drafts'
import { cn } from '@/lib/utils'
import { PlacementReleaseControl } from '../../draft/components/PlacementsPanel'

export function placementProgress(board: DraftBoard) {
  const perTeam = board.placement_rounds ?? 0
  const slots = perTeam * board.teams.length
  const placed = board.picks.filter((p) => p.pick_number <= slots)
  const teamsDone = board.teams.filter(
    (t) => placed.filter((p) => p.draft_team_id === t.id).length >= perTeam
  ).length
  return {
    slots,
    placed: placed.length,
    teamsDone,
    teamCount: board.teams.length,
    allDone: perTeam > 0 && teamsDone === board.teams.length,
  }
}

export function usePlacementSetup(cycleId: string, roleId: string) {
  const openDraft = useOpenDraft()
  async function setUp() {
    await openDraft.mutateAsync({ cycleId, roleId, placementsEnabled: true })
  }
  return { setUp, pending: openDraft.isPending }
}

export function PlacementRow({
  cycleId,
  roleId,
  roleLabel,
}: {
  cycleId: string
  roleId: string
  roleLabel: string
}) {
  const toCycle = useCycleHref()
  const router = useRouter()
  const [error, setError] = useState('')
  const { data: board, isLoading } = useDraftBoard(cycleId, roleId)
  const setReleased = useSetPlacementsReleased()
  const setup = usePlacementSetup(cycleId, roleId)
  const pageHref = toCycle(`/cycle/teams/placements/${roleId}`)

  async function setUpAndOpen() {
    setError('')
    try {
      await setup.setUp()
      router.push(pageHref)
    } catch {
      setError('Couldn’t set up placements. Try again.')
    }
  }

  const inSetup = board?.status === 'setup'
  const enabled = !!board?.placements_enabled
  const progress = board ? placementProgress(board) : null
  const released = !!board?.placements_released_at
  const clickable = !!board && inSetup

  const placedLabel =
    !progress || !enabled
      ? '—'
      : `${progress.teamsDone}/${progress.teamCount} teams`
  return (
    <tr
      onClick={() => clickable && router.push(pageHref)}
      className={cn(
        'border-b border-gray-100 last:border-b-0',
        clickable && 'cursor-pointer hover:bg-gray-50'
      )}
    >
      <td className="px-4 py-3">
        <span className="text-ink text-sm font-semibold">{roleLabel}</span>
        {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
      </td>
      <td className="text-ink px-4 py-3 text-sm tabular-nums">{placedLabel}</td>
      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
        {!board && !isLoading && (
          <Button
            variant="outline"
            size="sm"
            disabled={setup.pending}
            onClick={setUpAndOpen}
          >
            {setup.pending && <Loader2 className="animate-spin" size={14} />}
            Set up placements
          </Button>
        )}
        {board && !inSetup && (
          <Link
            href={toCycle(`/cycle/draft?role=${roleId}`)}
            className="text-ink inline-flex items-center gap-1 text-sm font-medium hover:underline"
          >
            Go to the draft <ArrowRight size={14} />
          </Link>
        )}
        {board && inSetup && enabled && progress && (
          <span className="inline-flex justify-end">
            <PlacementReleaseControl
              compact
              teamCount={progress.teamCount}
              ready={progress.allDone}
              released={released}
              releasing={setReleased.isPending}
              onRelease={(next) =>
                setReleased.mutate({
                  cycleId,
                  roleId,
                  draftId: board.id,
                  released: next,
                })
              }
            />
          </span>
        )}
      </td>
    </tr>
  )
}
