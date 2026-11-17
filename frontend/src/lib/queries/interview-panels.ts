import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createInterviewPanel,
  deleteInterviewPanel,
  listInterviewPanels,
} from '@/generated/interview-panels/interview-panels'
import type { InterviewPanelDetail } from '@/generated/model/interviewPanelDetail'
import { queryKeys } from './keys'

export type InterviewPanel = {
  id: string
  name: string
  members: { user_nuid: string; full_name: string }[]
}

export function useInterviewPanels(cycleId: string) {
  return useQuery({
    queryKey: queryKeys.interviewPanels.list(cycleId),
    queryFn: async () =>
      (
        ((await listInterviewPanels(cycleId)) ?? []) as InterviewPanelDetail[]
      ).map((p): InterviewPanel => ({
        id: p.id,
        name: p.name,
        members: p.members ?? [],
      })),
    enabled: !!cycleId,
  })
}

export function useInterviewPanelMutations(cycleId: string) {
  const queryClient = useQueryClient()
  const onSuccess = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.interviewPanels.list(cycleId),
    })
  return {
    create: useMutation({
      mutationFn: async (
        panels: { name: string; member_nuids: string[] }[]
      ) => {
        for (const p of panels) await createInterviewPanel(cycleId, p)
      },
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: (panelId: string) => deleteInterviewPanel(cycleId, panelId),
      onSuccess,
    }),
  }
}
