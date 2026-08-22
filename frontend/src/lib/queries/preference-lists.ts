import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addPreferenceListMember,
  createPreferenceList,
  deletePreferenceList,
  deletePreferenceListEntry,
  getLeadMeetingAvailability,
  getPreferenceList,
  getPreferenceListDeadline,
  listPreferenceLists,
  removePreferenceListMember,
  reorderPreferenceListEntries,
  setPreferenceListDeadline,
  setPreferenceListMeetingDay,
  updatePreferenceList,
  upsertPreferenceListEntry,
} from '@/generated/preference-lists/preference-lists'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type {
  LeadMeetingAvailability,
  MeetingDay,
  PreferenceList,
  PreferenceListDeadline,
  PreferenceListDetail,
  PreferenceListEntry,
  PreferenceListEntryDetail,
  PreferenceListMember,
  PreferenceListSummary,
  PreferenceListStatus,
  Role,
} from '@/lib/api/types'
import { queryKeys } from './keys'

export function usePreferenceLists(
  cycleId: string,
  role: Role,
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.preferenceLists.list(cycleId, role),
    queryFn: async () => {
      const lists = ((await listPreferenceLists(
        { cycle_id: cycleId, role },
        opts
      )) ?? []) as PreferenceListSummary[]
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

export function useCreatePreferenceList() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      cycleId: string
      role: Role
      name: string
      opts?: RequestOptions
    }) =>
      createPreferenceList(
        {
          cycle_id: vars.cycleId,
          application_role: vars.role,
          name: vars.name,
        },
        vars.opts
      ),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.preferenceLists.list(vars.cycleId, vars.role),
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
      role: Role
      body: { name?: string; status?: PreferenceListStatus }
      opts?: RequestOptions
    }) => updatePreferenceList(vars.id, vars.body, vars.opts),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.preferenceLists.detail(vars.id),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.preferenceLists.list(vars.cycleId, vars.role),
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
      role: Role
      opts?: RequestOptions
    }) => deletePreferenceList(vars.id, vars.opts),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.preferenceLists.list(vars.cycleId, vars.role),
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
    onSuccess: (data, vars) => {
      queryClient.setQueryData(queryKeys.preferenceLists.detail(vars.id), data)
    },
  })
}

// Bulk (one request for every candidate at once, not one per row) lookup of
// each lead's own selected "Meeting Availability" options, keyed by nuid —
// used to flag who's free for a list's chosen meeting day before adding them.
export function useLeadMeetingAvailability(
  nuids: string[],
  opts?: RequestOptions
) {
  return useQuery({
    queryKey: queryKeys.leadMeetingAvailability.bulk(nuids),
    queryFn: async () => {
      const items = ((await getLeadMeetingAvailability(
        { nuids: nuids.join(',') },
        opts
      )) ?? []) as LeadMeetingAvailability[]
      const byNuid = new Map<string, string[]>()
      for (const item of items) byNuid.set(item.nuid, item.options)
      return byNuid
    },
    enabled: nuids.length > 0,
  })
}
