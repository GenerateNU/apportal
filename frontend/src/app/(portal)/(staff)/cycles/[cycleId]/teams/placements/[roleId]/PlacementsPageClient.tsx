'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Loader2 } from 'lucide-react'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingText } from '@/components/ui/loading-text'
import { PageHeader } from '@/components/ui/page-header'
import { useCycleHref } from '@/hooks/useCycleHref'
import { useApplications } from '@/lib/queries/applications'
import {
  useDraftBoard,
  useMakeDraftPick,
  useRemoveDraftPick,
  useSetPlacementsReleased,
  useUpdateDraft,
} from '@/lib/queries/drafts'
import {
  usePreferenceListDeadline,
  usePreferenceListDetails,
} from '@/lib/queries/preference-lists'
import { useCycleRoles } from '@/lib/queries/roles'
import { PlacementsPanel } from '../../../draft/components/PlacementsPanel'
import { usePlacementSetup } from '../../components/PlacementSection'
import { deadlinePassed } from '../../[id]/components/deadline'

export function PlacementsPageClient({
  cycleId,
  roleId,
}: {
  cycleId: string
  roleId: string
}) {
  const toCycle = useCycleHref()
  const { roleLabel } = useCycleRoles(cycleId)
  const label = roleLabel(roleId)
  const { data: board, isLoading } = useDraftBoard(cycleId, roleId)
  const { data: lists = [] } = usePreferenceListDetails(cycleId)
  const { data: pool = [] } = useApplications(
    { cycle_id: cycleId, role_id: roleId },
    undefined,
    { enabled: !!board }
  )
  const { data: deadline } = usePreferenceListDeadline(cycleId, roleId)
  const setup = usePlacementSetup(
    cycleId,
    roleId,
    deadlinePassed(deadline?.closes_at)
  )
  const updateDraft = useUpdateDraft()
  const makePick = useMakeDraftPick()
  const removePick = useRemoveDraftPick()
  const setReleased = useSetPlacementsReleased()
  const [error, setError] = useState('')

  const header = (
    <PageHeader
      back={
        <Breadcrumbs
          items={[
            {
              label: 'Teams & preference lists',
              href: toCycle('/cycle/teams'),
            },
            { label: `${label} placements` },
          ]}
        />
      }
      title={`${label} placements`}
      subtitle="Place 2 applicants on each team from their lists, break any ties, then release them so every team sees theirs."
    />
  )

  if (isLoading) {
    return (
      <>
        {header}
        <LoadingText />
      </>
    )
  }

  if (!board) {
    return (
      <>
        {header}
        <EmptyState
          title="Placements aren't set up yet"
          description="Setting them up opens this position's draft board, with placements on."
          action={
            <Button
              disabled={setup.pending}
              onClick={() =>
                setup
                  .setUp()
                  .catch(() => setError('Couldn’t set up placements.'))
              }
            >
              {setup.pending && <Loader2 className="animate-spin" size={14} />}
              Set up placements
            </Button>
          }
        />
        {error && <p className="text-sm text-red-700">{error}</p>}
      </>
    )
  }

  if (board.status !== 'setup') {
    return (
      <>
        {header}
        <EmptyState
          title="The draft has started"
          description="Placements are the first rows on the draft board."
          action={
            <Button variant="outline" asChild>
              <Link href={toCycle(`/cycle/draft?role=${roleId}`)}>
                Go to the draft <ArrowRight size={14} />
              </Link>
            </Button>
          }
        />
      </>
    )
  }

  const scope = { cycleId, roleId, draftId: board.id }

  if (!board.placements_enabled) {
    return (
      <>
        {header}
        <EmptyState
          title="Placements are off for this draft"
          description="Turn them on to place 2 applicants on each team before picking starts."
          action={
            <Button
              disabled={updateDraft.isPending}
              onClick={() =>
                updateDraft.mutate({ ...scope, placementsEnabled: true })
              }
            >
              {updateDraft.isPending && (
                <Loader2 className="animate-spin" size={14} />
              )}
              Turn on placements
            </Button>
          }
        />
      </>
    )
  }
  return (
    <>
      {header}
      <PlacementsPanel
        title="Teams"
        board={board}
        lists={lists}
        pool={pool}
        orderUnsaved={false}
        onPlace={(slot, applicationId, name) => {
          setError('')
          makePick.mutate(
            {
              ...scope,
              applicationId,
              pickNumber: slot,
              applicant: { fullName: name, email: '' },
            },
            {
              onError: () =>
                setError(
                  'That placement didn’t go through. Someone may have filled the slot first.'
                ),
            }
          )
        }}
        onRemove={(slot) => removePick.mutate({ ...scope, pickNumber: slot })}
        onRelease={(released) => setReleased.mutate({ ...scope, released })}
        placing={makePick.isPending || removePick.isPending}
        releasing={setReleased.isPending}
      />
      {error && <p className="text-sm text-red-700">{error}</p>}
    </>
  )
}
