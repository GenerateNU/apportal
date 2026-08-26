import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteDraft,
  getDraftBoard,
  listDraftedApplications,
  makeDraftPick,
  openDraft,
  removeDraftPick,
  resetDraft,
  setDraftTeams,
  updateDraft,
} from '@/generated/draft/draft'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { DraftBoard, DraftStatus, Role } from '@/lib/api/types'
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

// Every write lands on the same board, so they all invalidate it the same way.
function useDraftMutation<TVars extends { cycleId: string; role: Role }>(
  mutationFn: (vars: TVars) => Promise<unknown>
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: (_data, vars) => {
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

export function useMakeDraftPick() {
  return useDraftMutation(
    (vars: {
      cycleId: string
      role: Role
      draftId: string
      applicationId: string
      pickNumber?: number
      opts?: RequestOptions
    }) =>
      makeDraftPick(
        vars.draftId,
        {
          application_id: vars.applicationId,
          ...(vars.pickNumber && { pick_number: vars.pickNumber }),
        },
        vars.opts
      )
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
    }) => removeDraftPick(vars.draftId, vars.pickNumber, vars.opts)
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
