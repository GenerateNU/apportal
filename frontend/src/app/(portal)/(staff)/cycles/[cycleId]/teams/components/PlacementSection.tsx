'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useCycleHref } from '@/hooks/useCycleHref'
import type { DraftBoard } from '@/lib/api/types'
import {
  useDraftBoard,
  useOpenDraft,
  useSetPlacementsReleased,
} from '@/lib/queries/drafts'
import { useSetPreferenceListDeadline } from '@/lib/queries/preference-lists'
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

export function usePlacementSetup(
  cycleId: string,
  roleId: string,
  listsClosed: boolean
) {
  const openDraft = useOpenDraft()
  const closeLists = useSetPreferenceListDeadline()
  async function setUp() {
    if (!listsClosed) {
      await closeLists.mutateAsync({
        cycleId,
        roleId,
        closesAt: new Date().toISOString(),
      })
    }
    await openDraft.mutateAsync({ cycleId, roleId, placementsEnabled: true })
  }
  return { setUp, pending: openDraft.isPending || closeLists.isPending }
}

export function PlacementRow({
  cycleId,
  roleId,
  roleLabel,
  listsClosed,
}: {
  cycleId: string
  roleId: string
  roleLabel: string
  listsClosed: boolean
}) {
  const toCycle = useCycleHref()
  const router = useRouter()
  const [closingLists, setClosingLists] = useState(false)
  const [error, setError] = useState('')
  const { data: board, isLoading } = useDraftBoard(cycleId, roleId)
  const setReleased = useSetPlacementsReleased()
  const setup = usePlacementSetup(cycleId, roleId, listsClosed)
  const pageHref = toCycle(`/cycle/teams/placements/${roleId}`)

  async function setUpAndOpen() {
    setError('')
    try {
      await setup.setUp()
      router.push(pageHref)
    } catch {
      setError('Couldn’t set up placements. Try again.')
    } finally {
      setClosingLists(false)
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
            onClick={() =>
              listsClosed ? setUpAndOpen() : setClosingLists(true)
            }
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
        <ConfirmDialog
          open={closingLists}
          onOpenChange={setClosingLists}
          title={`Close ${roleLabel} lists and set up placements?`}
          description="Every team has submitted, but the deadline hasn't passed. This closes the lists now, so teams can't edit them anymore."
          confirmLabel="Close lists"
          confirmVariant="default"
          pending={setup.pending}
          onConfirm={setUpAndOpen}
        />
      </td>
    </tr>
  )
}
