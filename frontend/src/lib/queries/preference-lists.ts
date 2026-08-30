import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addPreferenceListMember,
  createPreferenceList,
  createPreferenceListComment,
  deletePreferenceList,
  deletePreferenceListEntry,
  deletePreferenceListPersonalEntry,
  getPreferenceList,
  getPreferenceListDeadline,
  listPreferenceListDetails,
  listPreferenceLists,
  removePreferenceListMember,
  reorderPreferenceListEntries,
  reorderPreferenceListPersonalEntries,
  setPreferenceListDeadline,
  setPreferenceListMeetingDay,
  updatePreferenceList,
  updatePreferenceListComment,
  upsertPreferenceListEntry,
  upsertPreferenceListPersonalEntry,
} from '@/generated/preference-lists/preference-lists'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type {
  MeetingDay,
  PreferenceList,
  PreferenceListComment,
  PreferenceListDeadline,
  PreferenceListDetail,
  PreferenceListEntry,
  PreferenceListEntryDetail,
  PreferenceListMember,
  PreferenceListPersonalEntry,
  PreferenceListPersonalEntryDetail,
  PreferenceListSummary,
  PreferenceListStatus,
  Role,
} from '@/lib/api/types'
import { useCurrentUser } from './users'
import { queryKeys } from './keys'

export function usePreferenceLists(cycleId: string, opts?: RequestOptions) {
  return useQuery({
    queryKey: queryKeys.preferenceLists.list(cycleId),
    queryFn: async () => {
      const lists = ((await listPreferenceLists({ cycle_id: cycleId }, opts)) ??
        []) as PreferenceListSummary[]
      return lists.map((list) => ({
        ...list,
        member_names: list.member_names ?? [],
      }))
    },
    enabled: !!cycleId,
  })
}

// Polls while a detail page is open so collaborators editing the same list
// at once see each other's changes within a few seconds — this stack has no
// websockets/realtime channel today, so short-interval refetch is the
// pragmatic stand-in.
export function usePreferenceList(
  id: string,
  { poll = false }: { poll?: boolean } = {},
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.preferenceLists.detail(id),
    queryFn: () => getPreferenceList(id, opts) as Promise<PreferenceListDetail>,
    enabled: !!id,
    refetchInterval: poll ? 8000 : false,
  })
}

// Every group's full detail for a cycle in one request — the chief/admin
// "all groups side by side" board, not the per-group detail page (which
// keeps its own usePreferenceList above).
export function usePreferenceListDetails(
  cycleId: string,
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.preferenceLists.allDetails(cycleId),
    queryFn: async () =>
      ((await listPreferenceListDetails({ cycle_id: cycleId }, opts)) ??
        []) as PreferenceListDetail[],
    enabled: !!cycleId,
  })
}

export function useCreatePreferenceList() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      cycleId: string
      name: string
      opts?: RequestOptions
    }) =>
      createPreferenceList(
        {
          cycle_id: vars.cycleId,
          name: vars.name,
        },
        vars.opts
      ),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.preferenceLists.list(vars.cycleId),
      })
    },
  })
}

export function useUpdatePreferenceList() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      id: string
      cycleId: string
      body: { name?: string; status?: PreferenceListStatus }
      opts?: RequestOptions
    }) => updatePreferenceList(vars.id, vars.body, vars.opts),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.preferenceLists.detail(vars.id),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.preferenceLists.list(vars.cycleId),
      })
    },
  })
}

export function useDeletePreferenceList() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      id: string
      cycleId: string
      opts?: RequestOptions
    }) => deletePreferenceList(vars.id, vars.opts),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.preferenceLists.list(vars.cycleId),
      })
    },
  })
}

export function useAddPreferenceListMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      listId: string
      leadNuid: string
      opts?: RequestOptions
    }) =>
      addPreferenceListMember(
        vars.listId,
        { lead_nuid: vars.leadNuid },
        vars.opts
      ) as Promise<PreferenceListMember>,
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.preferenceLists.detail(vars.listId),
      })
    },
  })
}

export function useRemovePreferenceListMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      listId: string
      memberId: string
      opts?: RequestOptions
    }) => removePreferenceListMember(vars.listId, vars.memberId, vars.opts),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.preferenceLists.detail(vars.listId),
      })
    },
  })
}

export function useUpsertPreferenceListEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      listId: string
      applicationId: string
      reasoning?: string
      opts?: RequestOptions
    }) =>
      upsertPreferenceListEntry(
        vars.listId,
        vars.applicationId,
        { reasoning: vars.reasoning },
        vars.opts
      ) as Promise<PreferenceListEntry>,
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.preferenceLists.detail(vars.listId),
      })
    },
  })
}

export function useDeletePreferenceListEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      listId: string
      applicationId: string
      opts?: RequestOptions
    }) => deletePreferenceListEntry(vars.listId, vars.applicationId, vars.opts),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.preferenceLists.detail(vars.listId),
      })
    },
  })
}

// A reorder request carries one role's slice of ids, not the whole list, so
// the optimistic update refills exactly the positions (and ranks) that slice
// already held — every other role's entries keep theirs. `inScope` narrows
// further for personal lists, where the same application_id can appear under
// several owners and only the caller's own entries are being reordered.
function applyReorder<T extends { application_id: string; rank: number }>(
  entries: T[],
  applicationIds: string[],
  inScope: (entry: T) => boolean = () => true
): T[] {
  const requested = new Set(applicationIds)
  const isMoving = (entry: T) =>
    requested.has(entry.application_id) && inScope(entry)

  const slots = entries.filter(isMoving)
  const byId = new Map(slots.map((e) => [e.application_id, e]))
  const moved = applicationIds
    .map((id) => byId.get(id))
    .filter((e): e is T => !!e)
  // A slice that doesn't line up with what's cached (a stale list, a
  // concurrent edit) is left alone — onSettled refetches either way.
  if (moved.length === 0 || moved.length !== slots.length) return entries

  const ranks = slots.map((e) => e.rank)
  let i = 0
  return entries.map((entry) => {
    if (!isMoving(entry)) return entry
    const next = { ...moved[i], rank: ranks[i] }
    i += 1
    return next
  })
}

export function useReorderPreferenceListEntries() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      listId: string
      applicationIds: string[]
      opts?: RequestOptions
    }) =>
      reorderPreferenceListEntries(
        vars.listId,
        { application_ids: vars.applicationIds },
        vars.opts
      ) as Promise<PreferenceListEntryDetail[]>,
    // Dragging a row that snaps back for a round trip reads as a failed
    // drag, so the new order is written to the cache immediately and rolled
    // back only if the request actually fails.
    onMutate: async (vars) => {
      const key = queryKeys.preferenceLists.detail(vars.listId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<PreferenceListDetail>(key)
      queryClient.setQueryData<PreferenceListDetail>(
        key,
        (data) =>
          data && {
            ...data,
            entries: applyReorder(data.entries, vars.applicationIds),
          }
      )
      return { previous }
    },
    onError: (_error, vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.preferenceLists.detail(vars.listId),
          context.previous
        )
      }
    },
    // Settled rather than success: the rollback above restores a snapshot
    // that the 8s poll may already have moved past.
    onSettled: (_data, _error, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.preferenceLists.detail(vars.listId),
      })
    },
  })
}

// Personal-list mutations always act on the calling user's own entries —
// there's no owner param, since "personal" only ever means "mine" for
// writes. Reads come along for free in usePreferenceList's detail.personal_entries.

export function useUpsertPersonalPreferenceListEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      listId: string
      applicationId: string
      reasoning?: string
      opts?: RequestOptions
    }) =>
      upsertPreferenceListPersonalEntry(
        vars.listId,
        vars.applicationId,
        { reasoning: vars.reasoning },
        vars.opts
      ) as Promise<PreferenceListPersonalEntry>,
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.preferenceLists.detail(vars.listId),
      })
    },
  })
}

export function useDeletePersonalPreferenceListEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      listId: string
      applicationId: string
      opts?: RequestOptions
    }) =>
      deletePreferenceListPersonalEntry(
        vars.listId,
        vars.applicationId,
        vars.opts
      ),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.preferenceLists.detail(vars.listId),
      })
    },
  })
}

export function useReorderPersonalPreferenceListEntries() {
  const queryClient = useQueryClient()
  // Writes are always "mine"; the optimistic update needs the nuid to avoid
  // reordering another owner's copy of the same applicant.
  const { data: currentUser } = useCurrentUser()
  return useMutation({
    mutationFn: (vars: {
      listId: string
      applicationIds: string[]
      opts?: RequestOptions
    }) =>
      reorderPreferenceListPersonalEntries(
        vars.listId,
        { application_ids: vars.applicationIds },
        vars.opts
      ) as Promise<PreferenceListPersonalEntryDetail[]>,
    onMutate: async (vars) => {
      const key = queryKeys.preferenceLists.detail(vars.listId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<PreferenceListDetail>(key)
      const ownerNuid = currentUser?.nuid
      if (!ownerNuid) return { previous }
      queryClient.setQueryData<PreferenceListDetail>(
        key,
        (data) =>
          data && {
            ...data,
            personal_entries: applyReorder(
              data.personal_entries,
              vars.applicationIds,
              (entry) => entry.owner_nuid === ownerNuid
            ),
          }
      )
      return { previous }
    },
    onError: (_error, vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.preferenceLists.detail(vars.listId),
          context.previous
        )
      }
    },
    onSettled: (_data, _error, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.preferenceLists.detail(vars.listId),
      })
    },
  })
}

export function usePreferenceListDeadline(
  cycleId: string,
  role: Role,
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.preferenceListDeadline.detail(cycleId, role),
    queryFn: () =>
      getPreferenceListDeadline(
        cycleId,
        { role },
        opts
      ) as Promise<PreferenceListDeadline>,
    enabled: !!cycleId,
  })
}

export function useSetPreferenceListDeadline() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      cycleId: string
      role: Role
      closesAt: string | null
      opts?: RequestOptions
    }) =>
      setPreferenceListDeadline(
        vars.cycleId,
        { closes_at: vars.closesAt ?? undefined },
        { role: vars.role },
        vars.opts
      ) as Promise<PreferenceListDeadline>,
    // Optimistic because the picker reads the deadline straight back out of
    // this cache entry — without it, every edit flashes the old time until
    // the round trip lands.
    onMutate: async (vars) => {
      const key = queryKeys.preferenceListDeadline.detail(
        vars.cycleId,
        vars.role
      )
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<PreferenceListDeadline>(key)
      if (previous) {
        queryClient.setQueryData(key, {
          ...previous,
          closes_at: vars.closesAt ?? undefined,
        })
      }
      return { previous }
    },
    onError: (_err, vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.preferenceListDeadline.detail(vars.cycleId, vars.role),
          context.previous
        )
      }
    },
    onSuccess: (data, vars) => {
      queryClient.setQueryData(
        queryKeys.preferenceListDeadline.detail(vars.cycleId, vars.role),
        data
      )
    },
  })
}

export function useSetPreferenceListMeetingDay() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      id: string
      meetingDay: MeetingDay | null
      opts?: RequestOptions
    }) =>
      setPreferenceListMeetingDay(
        vars.id,
        { meeting_day: vars.meetingDay ?? undefined },
        vars.opts
      ) as Promise<PreferenceList>,
    // The endpoint returns a bare PreferenceList, not the full
    // PreferenceListDetail (members/entries/personal_entries/comments) that's
    // actually cached under this key — writing it in directly would strip
    // those fields and crash the next render. Invalidate and refetch instead.
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.preferenceLists.detail(vars.id),
      })
    },
  })
}

// Comments ride along in usePreferenceList's detail.comments — no separate
// query key, just invalidate the detail on create/edit.

export function useCreatePreferenceListComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      listId: string
      applicationId?: string
      body: string
      opts?: RequestOptions
    }) =>
      createPreferenceListComment(
        vars.listId,
        { application_id: vars.applicationId, body: vars.body },
        vars.opts
      ) as Promise<PreferenceListComment>,
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.preferenceLists.detail(vars.listId),
      })
    },
  })
}

export function useUpdatePreferenceListComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      listId: string
      commentId: string
      body: string
      opts?: RequestOptions
    }) =>
      updatePreferenceListComment(
        vars.listId,
        vars.commentId,
        { body: vars.body },
        vars.opts
      ) as Promise<PreferenceListComment>,
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.preferenceLists.detail(vars.listId),
      })
    },
  })
}
