'use client'

import { useState } from 'react'
import { ListOrdered, Loader2 } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { APIError } from '@/lib/api/client'
import type { Role } from '@/lib/api/types'
import { useApplications } from '@/lib/queries/applications'
import { pickDefaultCycleId, useCycles } from '@/lib/queries/cycles'
import {
  useDeleteDraft,
  useDraftBoard,
  useDraftedApplications,
  useMakeDraftPick,
  useOpenDraft,
  useRemoveDraftPick,
  useReplaceDraftPick,
  useResetDraft,
  useSetDraftTeams,
  useUpdateDraft,
} from '@/lib/queries/drafts'
import {
  usePreferenceList,
  usePreferenceLists,
} from '@/lib/queries/preference-lists'
import { useCurrentUser } from '@/lib/queries/users'
import { ROLE_COLUMNS, ROLE_LABEL } from '@/lib/roles'
import {
  DRAFT_STATUS_BADGE,
  DRAFT_STATUS_LABEL,
  SECTION_CLASS,
  SECTION_HEADER_CLASS,
} from './constants'
import { DraftBoardGrid } from './DraftBoardGrid'
import { DraftSetup } from './DraftSetup'
import { OnTheClockPanel } from './OnTheClockPanel'
import { ReorderTeamsDialog } from './ReorderTeamsDialog'

export function DraftClient() {
  const { data: currentUser } = useCurrentUser()
  const isChief = !!currentUser?.roles.some(
    (r) => r === 'chief' || r === 'admin'
  )

  const { data: cycles = [] } = useCycles({})
  const [cycleId, setCycleId] = useState('')
  if (!cycleId && cycles.length > 0) {
    const defaultId = pickDefaultCycleId(cycles)
    if (defaultId) setCycleId(defaultId)
  }
  // Separate boards per role, switched here — engineers and designers draft
  // independently, the same way their preference ranks are scoped.
  const [role, setRole] = useState<Role>(ROLE_COLUMNS[0])

  const {
    data: board,
    isLoading,
    isError,
  } = useDraftBoard(cycleId, role, { poll: true })
  const { data: groups = [] } = usePreferenceLists(cycleId)
  const { data: takenByApplicationId = {} } = useDraftedApplications(cycleId, {
    poll: true,
  })
  const { data: pool = [] } = useApplications(
    cycleId ? { cycle_id: cycleId, role } : undefined,
    undefined,
    { enabled: !!cycleId }
  )

  // The on-the-clock team's own ranking, so the operator can pick straight
  // down it. One fetch, and it shares a cache key with the list's own page.
  const onTheClockTeam = board?.teams.find(
    (t) => t.id === board.on_the_clock_team_id
  )
  const { data: teamList } = usePreferenceList(
    onTheClockTeam?.preference_list_id ?? ''
  )

  const openDraft = useOpenDraft()
  const updateDraft = useUpdateDraft()
  const setTeams = useSetDraftTeams()
  const makePick = useMakeDraftPick()
  const removePick = useRemoveDraftPick()
  const replacePick = useReplaceDraftPick()
  const resetDraft = useResetDraft()
  // Which filled slot is being reassigned; null while that dialog is closed.
  const [changingSlot, setChangingSlot] = useState<number | null>(null)
  const [changeQuery, setChangeQuery] = useState('')
  const deleteDraft = useDeleteDraft()
  // Which teardown is being confirmed; null while the dialog is closed.
  const [confirming, setConfirming] = useState<'reset' | 'delete' | null>(null)
  const [reordering, setReordering] = useState(false)
  const [reorderError, setReorderError] = useState('')

  // Setup-screen state. Seeded from the board once, then owned here so
  // reordering doesn't fight the 8s poll.
  const [order, setOrder] = useState<string[] | null>(null)
  const [rounds, setRounds] = useState<number | null>(null)
  const [removingPick, setRemovingPick] = useState<number | null>(null)
  const [pickError, setPickError] = useState('')

  const draftScope = { cycleId, role, draftId: board?.id ?? '' }
  const effectiveOrder =
    order ?? board?.teams.map((t) => t.preference_list_id) ?? []
  const effectiveRounds = rounds ?? board?.rounds ?? 1

  function reorderSeats(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return
    const next = [...effectiveOrder]
    if (from >= next.length || to >= next.length) return
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setOrder(next)
  }

  function toggleInOrder(id: string) {
    setOrder(
      effectiveOrder.includes(id)
        ? effectiveOrder.filter((x) => x !== id)
        : [...effectiveOrder, id]
    )
  }

  const changingSlotPick = board?.picks.find(
    (p) => p.pick_number === changingSlot
  )
  // Everyone this board could still take, plus whoever holds the slot now, so
  // the current pick is visible in the list rather than missing from it.
  const changeOptions = pool
    .filter(
      (a) =>
        !takenByApplicationId[a.id] || a.id === changingSlotPick?.application_id
    )
    .filter((a) =>
      changeQuery.trim()
        ? (a.full_name || a.user_nuid)
            .toLowerCase()
            .includes(changeQuery.trim().toLowerCase())
        : true
    )
    .sort((a, b) =>
      (a.full_name || a.user_nuid).localeCompare(b.full_name || b.user_nuid)
    )

  function closeChangeDialog() {
    setChangingSlot(null)
    setChangeQuery('')
    replacePick.reset()
  }

  // The pool row behind an id, so a predicted pick shows the person rather
  // than their id in the beat before the refetch lands.
  function applicantFor(applicationId: string) {
    const a = pool.find((x) => x.id === applicationId)
    if (!a) return undefined
    return { fullName: a.full_name || a.user_nuid, email: a.email }
  }

  function pick(applicationId: string) {
    setPickError('')
    makePick.mutate(
      { ...draftScope, applicationId, applicant: applicantFor(applicationId) },
      {
        onError: () =>
          setPickError(
            'That pick didn’t go through — someone may have filled the slot first. The board refreshes every few seconds.'
          ),
      }
    )
  }

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-text-default text-2xl font-semibold">Draft</h1>
        <p className="text-text-muted mt-1 text-sm">
          Teams claim applicants in snake order — the first round runs down the
          order, the next back up it, so the last team picks twice at the turn.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {board && (
          <span
            className={`rounded-md px-2 py-0.5 text-xs font-medium ${DRAFT_STATUS_BADGE[board.status]}`}
          >
            {DRAFT_STATUS_LABEL[board.status]}
          </span>
        )}
        <Select value={role} onValueChange={(v) => setRole(v as Role)}>
          <SelectTrigger className="w-48" aria-label="Draft board role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_COLUMNS.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABEL[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={cycleId} onValueChange={setCycleId}>
          <SelectTrigger className="w-40" aria-label="Cycle">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {cycles.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )

  if (!cycleId || isLoading) {
    return (
      <>
        {header}
        <p className="text-text-muted text-sm">Loading…</p>
      </>
    )
  }

  // A board that hasn't been opened 404s, which is the normal starting state.
  if (isError || !board) {
    return (
      <>
        {header}
        <div className={SECTION_CLASS}>
          <h2 className={SECTION_HEADER_CLASS}>{ROLE_LABEL[role]} draft</h2>
          {isChief ? (
            <>
              <p className="text-text-muted text-sm">
                No board yet for this cycle and role. Opening one lets you set
                the order before anyone picks.
              </p>
              <div>
                <Button
                  onClick={() => openDraft.mutate({ cycleId, role })}
                  disabled={openDraft.isPending}
                >
                  {openDraft.isPending && (
                    <Loader2 className="animate-spin" size={14} />
                  )}
                  Open the board
                </Button>
              </div>
            </>
          ) : (
            <p className="text-text-muted text-sm">
              This draft hasn&apos;t been opened yet.
            </p>
          )}
        </div>
      </>
    )
  }

  if (board.status === 'setup') {
    return (
      <>
        {header}
        {isChief ? (
          <DraftSetup
            board={board}
            groups={groups}
            order={effectiveOrder}
            rounds={effectiveRounds}
            onToggle={toggleInOrder}
            onMove={(index, direction) =>
              reorderSeats(index, index + direction)
            }
            onReorder={reorderSeats}
            onRoundsChange={(n) => setRounds(Math.max(1, n))}
            onSave={() =>
              setTeams.mutate({
                ...draftScope,
                preferenceListIds: effectiveOrder,
              })
            }
            onStart={() =>
              updateDraft.mutate(
                { ...draftScope, status: 'active', rounds: effectiveRounds },
                { onSuccess: () => setOrder(null) }
              )
            }
            saving={setTeams.isPending}
            starting={updateDraft.isPending}
          />
        ) : (
          <div className={SECTION_CLASS}>
            <h2 className={SECTION_HEADER_CLASS}>Draft order</h2>
            <p className="text-text-muted text-sm">
              The order is still being set. The board appears here once the
              draft starts.
            </p>
          </div>
        )}
      </>
    )
  }

  return (
    <>
      {header}

      {board.status === 'active' && (
        <OnTheClockPanel
          board={board}
          teamList={teamList}
          pool={pool}
          takenByApplicationId={takenByApplicationId}
          canPick={isChief}
          onPick={pick}
          picking={makePick.isPending}
          error={pickError}
        />
      )}

      <DraftBoardGrid
        board={board}
        canEdit={isChief}
        onChangePick={setChangingSlot}
        removingPick={removingPick}
        onRemovePick={(pickNumber) => {
          setRemovingPick(pickNumber)
          removePick.mutate(
            { ...draftScope, pickNumber },
            { onSettled: () => setRemovingPick(null) }
          )
        }}
      />

      {isChief && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() =>
              updateDraft.mutate({
                ...draftScope,
                rounds: board.rounds + 1,
              })
            }
            disabled={updateDraft.isPending}
          >
            Add a round
          </Button>
          {board.status === 'active' && (
            <Button
              variant="outline"
              onClick={() => {
                setReorderError('')
                setReordering(true)
              }}
            >
              <ListOrdered data-icon="inline-start" size={14} />
              Reorder pick order
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() =>
              updateDraft.mutate({
                ...draftScope,
                status: board.status === 'complete' ? 'active' : 'complete',
              })
            }
            disabled={updateDraft.isPending}
          >
            {board.status === 'complete' ? 'Reopen draft' : 'Mark complete'}
          </Button>
          <span className="mx-1 h-5 w-px bg-gray-200" aria-hidden />
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirming('reset')}
          >
            Reset picks
          </Button>
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirming('delete')}
          >
            Delete board
          </Button>
        </div>
      )}

      <ReorderTeamsDialog
        board={board}
        open={reordering}
        onOpenChange={setReordering}
        saving={setTeams.isPending}
        error={reorderError}
        onSave={(preferenceListIds) => {
          setReorderError('')
          setTeams.mutate(
            { ...draftScope, preferenceListIds },
            {
              onSuccess: () => setReordering(false),
              onError: (err) =>
                setReorderError(
                  err instanceof APIError
                    ? err.message
                    : "Couldn't save the new order — try again."
                ),
            }
          )
        }}
      />

      <Dialog
        open={changingSlot !== null}
        onOpenChange={(open) => !open && closeChangeDialog()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change pick #{changingSlot}</DialogTitle>
            <DialogDescription>
              {changingSlotPick
                ? `${changingSlotPick.full_name || changingSlotPick.application_id} goes back to the stage they were in before this pick, and whoever you choose takes the slot. The order and whose turn it is don't change.`
                : 'Choose who takes this slot.'}
            </DialogDescription>
          </DialogHeader>
          {replacePick.isError && (
            <p className="text-destructive text-sm">
              Couldn&apos;t change that pick — they may already be picked in
              another slot.
            </p>
          )}
          {/* Listed inline rather than behind a dropdown: a Popover portals to
              the body, which a modal Dialog makes unclickable — and picking a
              person is the only thing this dialog is for. */}
          <Input
            value={changeQuery}
            onChange={(e) => setChangeQuery(e.target.value)}
            placeholder="Search applicants…"
            aria-label="Search applicants"
            className="h-9"
          />
          <div className="-mx-1 max-h-72 overflow-y-auto px-1">
            {changeOptions.length === 0 ? (
              <p className="text-text-muted py-3 text-sm">
                No applicants match.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {changeOptions.map((a) => {
                  const current = a.id === changingSlotPick?.application_id
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        disabled={current || replacePick.isPending}
                        onClick={() => {
                          if (changingSlot === null) return
                          replacePick.mutate(
                            {
                              ...draftScope,
                              pickNumber: changingSlot,
                              applicationId: a.id,
                              applicant: {
                                fullName: a.full_name || a.user_nuid,
                                email: a.email,
                              },
                            },
                            { onSuccess: closeChangeDialog }
                          )
                        }}
                        className="hover:bg-muted flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors disabled:cursor-default disabled:hover:bg-transparent"
                      >
                        <Avatar name={a.full_name || a.user_nuid} size="sm" />
                        <div className="min-w-0 flex-1">
                          <span className="text-text-default block truncate text-sm font-medium">
                            {a.full_name || a.user_nuid}
                          </span>
                          <span className="text-text-subtle block truncate text-xs">
                            {a.email}
                          </span>
                        </div>
                        {current && (
                          <span className="text-text-muted shrink-0 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium">
                            Current
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeChangeDialog}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirming === 'delete' ? 'Delete this board?' : 'Reset picks?'}
            </DialogTitle>
            <DialogDescription>
              {confirming === 'delete'
                ? `Removes the board, its order, and all ${board.picks.length} picks. Every applicant it claimed goes back to the stage they were in before their pick.`
                : `Clears all ${board.picks.length} picks and returns the board to setup, putting each applicant back in the stage they were in before their pick. The draft order is kept.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={resetDraft.isPending || deleteDraft.isPending}
              onClick={() => {
                const mutation =
                  confirming === 'delete' ? deleteDraft : resetDraft
                mutation.mutate(draftScope, {
                  onSuccess: () => {
                    // Both land back on an editable order, so the locally held
                    // setup state has to re-seed from the server.
                    setOrder(null)
                    setRounds(null)
                    setConfirming(null)
                  },
                })
              }}
            >
              {(resetDraft.isPending || deleteDraft.isPending) && (
                <Loader2 className="animate-spin" size={14} />
              )}
              {confirming === 'delete' ? 'Delete board' : 'Reset picks'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
