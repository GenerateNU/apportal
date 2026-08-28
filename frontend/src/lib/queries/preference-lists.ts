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
    onSuccess: (_data, vars) => {
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
    onSuccess: (_data, vars) => {
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
