import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  clearStaffSlot,
  createMeetingSlot,
  deleteMeetingSlot,
  listMeetingSlots,
  listStaffSlots,
  renameMeetingSlot,
  reorderMeetingSlots,
  setMatchBySlot,
  setStaffSlot,
} from '@/generated/meeting-slots/meeting-slots'
import type { MeetingSlot } from '@/generated/model/meetingSlot'
import type { StaffSlot } from '@/generated/model/staffSlot'
import { queryKeys } from './keys'

export type { MeetingSlot }

export function useMeetingSlots(cycleId: string) {
  return useQuery({
    queryKey: queryKeys.meetingSlots.list(cycleId),
    queryFn: async () =>
      ((await listMeetingSlots(cycleId)) ?? []) as MeetingSlot[],
    enabled: !!cycleId,
  })
}

export function useStaffSlots(cycleId: string) {
  return useQuery({
    queryKey: queryKeys.meetingSlots.staff(cycleId),
    queryFn: async () =>
      new Map(
        (((await listStaffSlots(cycleId)) ?? []) as StaffSlot[]).map((r) => [
          r.user_nuid,
          r.slot_id,
        ])
      ),
    enabled: !!cycleId,
  })
}

export function useMeetingSlotMutations(cycleId: string) {
  const queryClient = useQueryClient()
  const onSuccess = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.meetingSlots.all })
  return {
    create: useMutation({
      mutationFn: (label: string) => createMeetingSlot(cycleId, { label }),
      onSuccess,
    }),
    rename: useMutation({
      mutationFn: (v: { id: string; label: string }) =>
        renameMeetingSlot(cycleId, v.id, { label: v.label }),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteMeetingSlot(cycleId, id),
      onSuccess,
    }),
    reorder: useMutation({
      mutationFn: (slotIds: string[]) =>
        reorderMeetingSlots(cycleId, { slot_ids: slotIds }),
      onSuccess,
    }),
    setStaff: useMutation({
      mutationFn: async (v: { nuid: string; slotId: string | null }) => {
        if (v.slotId) await setStaffSlot(cycleId, v.nuid, { slot_id: v.slotId })
        else await clearStaffSlot(cycleId, v.nuid)
      },
      onSuccess,
    }),
    setMatching: useMutation({
      mutationFn: (enabled: boolean) => setMatchBySlot(cycleId, { enabled }),
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: queryKeys.cycles.all }),
    }),
  }
}
