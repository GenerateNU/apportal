import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteDraft,
  getDraftBoard,
  listDraftedApplications,
  makeDraftPick,
  openDraft,
  removeDraftPick,
  replaceDraftPick,
  resetDraft,
  setDraftTeams,
  updateDraft,
} from '@/generated/draft/draft'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type {
  DraftBoard,
  DraftPickDetail,
  DraftStatus,
  Role,
} from '@/lib/api/types'
import { queryKeys } from './keys'

// The board is driven by one operator in a room full of people watching it, so
// it polls on the same 8s cadence the preference lists use — everyone sees a
// pick land without reloading.
const DRAFT_POLL_MS = 8000

export function useDraftBoard(
  cycleId: string,
  role: Role,
  { poll = false }: { poll?: boolean } = {},
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.drafts.board(cycleId, role),
    queryFn: () =>
      getDraftBoard(cycleId, { role }, opts) as Promise<DraftBoard>,
    enabled: !!cycleId,
    refetchInterval: poll ? DRAFT_POLL_MS : false,
    // A board that hasn't been opened yet 404s, which is a normal state here
    // (the setup screen offers to open it), not something to retry into.
    retry: false,
  })
}

// Application id -> the name of the team that took them, across every board in
// the cycle. Cheap enough to poll alongside a list people draft from.
export function useDraftedApplications(
  cycleId: string,
  { poll = false }: { poll?: boolean } = {},
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.drafts.drafted(cycleId),
    queryFn: async () =>
      ((await listDraftedApplications(cycleId, opts)) ?? {}) as Record<
        string,
        string
      >,
    enabled: !!cycleId,
    refetchInterval: poll ? DRAFT_POLL_MS : false,
  })
}

// Which team holds a slot. Filling or emptying a slot never changes the
// mapping — a pick is stamped with the team the mapping already gave it — so
// the board's own slots stay valid across an optimistic update.
export function ownerOfSlot(board: DraftBoard, slot: number) {
  return board.slots?.find((s) => s.pick_number === slot)?.draft_team_id
}

// The lowest unfilled slot is what's on the clock, so undoing a pick mid-board
// puts that slot back rather than the end of the board. Mirrors nextOpenSlot
// and DraftBoard in the backend's store/drafts.go — a predicted board that
// disagrees would name the wrong team until the refetch corrects it. Exported
// for the test that holds it to those two.
export function withOnTheClock(board: DraftBoard): DraftBoard {
  const filled = new Set(board.picks.map((p) => p.pick_number))
  let slot = 0
  for (let n = 1; n <= board.rounds * board.teams.length; n++) {
    if (!filled.has(n)) {
      slot = n
      break
    }
  }
  if (slot === 0 || board.status !== 'active' || board.teams.length === 0) {
    return { ...board, on_the_clock: 0, on_the_clock_team_id: undefined }
  }
  return {
    ...board,
    on_the_clock: slot,
    on_the_clock_team_id: ownerOfSlot(board, slot),
  }
}

// Applicant id -> the team holding them. Patched by diffing the picks rather
// than rebuilt from the board, because this map spans the other role's board
// too and rebuilding would drop it.
export function patchDrafted(
  drafted: Record<string, string>,
  before: DraftBoard,
  after: DraftBoard
): Record<string, string> {
  const next = { ...drafted }
  const held = new Set(after.picks.map((p) => p.application_id))
  for (const pick of before.picks) {
    if (!held.has(pick.application_id)) delete next[pick.application_id]
  }
  const wasHeld = new Set(before.picks.map((p) => p.application_id))
  for (const pick of after.picks) {
    if (wasHeld.has(pick.application_id)) continue
    const team = after.teams.find((t) => t.id === pick.draft_team_id)
    if (team) next[pick.application_id] = team.name
  }
  return next
}

// Every write lands on the same board, so they all invalidate it the same way.
// The pick mutations additionally pass a `predict`, which rewrites the cached
// board so the pick is on screen before the round trip finishes — this board
// is projected in a room, and the wait was visible from the back of it.
function useDraftMutation<TVars extends { cycleId: string; role: Role }>(
  mutationFn: (vars: TVars) => Promise<unknown>,
  predict?: (board: DraftBoard, vars: TVars) => DraftBoard
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onMutate: predict
      ? async (vars: TVars) => {
          const boardKey = queryKeys.drafts.board(vars.cycleId, vars.role)
          const draftedKey = queryKeys.drafts.drafted(vars.cycleId)
          // Both poll every 8s; an in-flight refetch would land on top of the
          // prediction and undo it.
          await queryClient.cancelQueries({ queryKey: boardKey })
          await queryClient.cancelQueries({ queryKey: draftedKey })

          const board = queryClient.getQueryData<DraftBoard>(boardKey)
          const drafted =
            queryClient.getQueryData<Record<string, string>>(draftedKey)
          if (board) {
            const next = withOnTheClock(predict(board, vars))
            queryClient.setQueryData(boardKey, next)
            if (drafted) {
              queryClient.setQueryData(
                draftedKey,
                patchDrafted(drafted, board, next)
              )
            }
          }
          return { boardKey, draftedKey, board, drafted }
        }
      : undefined,
    onError: (_error, _vars, context) => {
      if (!context?.board) return
      queryClient.setQueryData(context.boardKey, context.board)
      if (context.drafted) {
        queryClient.setQueryData(context.draftedKey, context.drafted)
      }
    },
    // Settled rather than success: a rejected pick (someone filled the slot
    // first) has to resync as well, not just roll back to a board that is by
    // then out of date.
    onSettled: (_data, _error, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.drafts.board(vars.cycleId, vars.role),
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.drafts.all })
      // A pick moves the applicant to accepted (and undoing it moves them
      // back), which every application list on screen is showing.
      queryClient.invalidateQueries({ queryKey: queryKeys.applications.all })
    },
  })
}

export function useOpenDraft() {
  return useDraftMutation(
    (vars: {
      cycleId: string
      role: Role
      rounds?: number
      opts?: RequestOptions
    }) =>
      openDraft(
        vars.cycleId,
        { role: vars.role, ...(vars.rounds && { rounds: vars.rounds }) },
        vars.opts
      )
  )
}

export function useUpdateDraft() {
  return useDraftMutation(
    (vars: {
      cycleId: string
      role: Role
      draftId: string
      status?: DraftStatus
      rounds?: number
      opts?: RequestOptions
    }) =>
      updateDraft(
        vars.draftId,
        {
          ...(vars.status && { status: vars.status }),
          ...(vars.rounds && { rounds: vars.rounds }),
        },
        vars.opts
      )
  )
}

export function useSetDraftTeams() {
  return useDraftMutation(
    (vars: {
      cycleId: string
      role: Role
      draftId: string
      preferenceListIds: string[]
      opts?: RequestOptions
    }) =>
      setDraftTeams(
        vars.draftId,
        { preference_list_ids: vars.preferenceListIds },
        vars.opts
      )
  )
}

// Name and email are only for the predicted row — the caller has them from
// the pool it picked out of, and without them the board shows a bare id until
// the refetch lands.
type PickApplicant = { fullName: string; email: string }

// picked_by, previous_stage and picked_at are the server's to assign and
// nothing renders them; they're here to fill the shape until the refetch
// replaces this row wholesale.
function predictedPick(
  board: DraftBoard,
  slot: number,
  teamId: string,
  applicationId: string,
  applicant?: PickApplicant
): DraftPickDetail {
  return {
    id: `predicted-${slot}`,
    draft_id: board.id,
    draft_team_id: teamId,
    pick_number: slot,
    application_id: applicationId,
    full_name: applicant?.fullName ?? '',
    email: applicant?.email ?? '',
    picked_at: new Date().toISOString(),
    picked_by: '',
    previous_stage: '',
  }
}

export function useMakeDraftPick() {
  return useDraftMutation(
    (vars: {
      cycleId: string
      role: Role
      draftId: string
      applicationId: string
      pickNumber?: number
      applicant?: PickApplicant
      opts?: RequestOptions
    }) =>
      makeDraftPick(
        vars.draftId,
        {
          application_id: vars.applicationId,
          ...(vars.pickNumber && { pick_number: vars.pickNumber }),
        },
        vars.opts
      ),
    (board, vars) => {
      const slot = vars.pickNumber ?? board.on_the_clock
      // Nothing on the clock, or a slot that's already taken: leave the board
      // alone and let the server's answer stand rather than guess at one this
      // pick can't land in.
      if (!slot || board.picks.some((p) => p.pick_number === slot)) return board
      const teamId = ownerOfSlot(board, slot)
      if (!teamId) return board
      return {
        ...board,
        picks: [
          ...board.picks,
          predictedPick(
            board,
            slot,
            teamId,
            vars.applicationId,
            vars.applicant
          ),
        ],
      }
    }
  )
}

export function useRemoveDraftPick() {
  return useDraftMutation(
    (vars: {
      cycleId: string
      role: Role
      draftId: string
      pickNumber: number
      opts?: RequestOptions
    }) => removeDraftPick(vars.draftId, vars.pickNumber, vars.opts),
    // Emptying the slot puts it back on the clock, since it becomes the lowest
    // unfilled one.
    (board, vars) => ({
      ...board,
      picks: board.picks.filter((p) => p.pick_number !== vars.pickNumber),
    })
  )
}

// Clears every pick and returns the board to setup, putting each applicant
// back in the stage they were in before their pick. The order survives — a
// rehearsal can be wiped without rebuilding it.
export function useResetDraft() {
  return useDraftMutation(
    (vars: {
      cycleId: string
      role: Role
      draftId: string
      opts?: RequestOptions
    }) => resetDraft(vars.draftId, vars.opts)
  )
}

// Removes the board entirely, undoing its picks' stage changes first.
export function useDeleteDraft() {
  return useDraftMutation(
    (vars: {
      cycleId: string
      role: Role
      draftId: string
      opts?: RequestOptions
    }) => deleteDraft(vars.draftId, vars.opts)
  )
}

// Swaps the applicant in an already-filled slot. In place, so the slot never
// reopens and the team on the clock stays put.
export function useReplaceDraftPick() {
  return useDraftMutation(
    (vars: {
      cycleId: string
      role: Role
      draftId: string
      pickNumber: number
      applicationId: string
      applicant?: PickApplicant
      opts?: RequestOptions
    }) =>
      replaceDraftPick(
        vars.draftId,
        vars.pickNumber,
        { application_id: vars.applicationId },
        vars.opts
      ),
    // The slot keeps its number, so the board's shape and whose turn it is
    // both stay put — only the person in it changes.
    (board, vars) => ({
      ...board,
      picks: board.picks.map((p) =>
        p.pick_number === vars.pickNumber
          ? {
              ...p,
              application_id: vars.applicationId,
              full_name: vars.applicant?.fullName ?? '',
              email: vars.applicant?.email ?? '',
            }
          : p
      ),
    })
  )
}
