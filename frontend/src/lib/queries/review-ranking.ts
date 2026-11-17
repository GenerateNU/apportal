import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  advanceShortlist,
  deleteReviewCutoff,
  deleteReviewCutoffOverride,
  deleteReviewCutoffOverrides,
  getReviewRanking,
  putReviewCutoff,
  putReviewCutoffOverride,
} from '@/generated/review-ranking/review-ranking'
import type { PutCutoffInputBodyMode } from '@/generated/model/putCutoffInputBodyMode'
import type { ReviewRanking } from '@/generated/model/reviewRanking'
import { queryKeys } from './keys'

export type CutoffMode = PutCutoffInputBodyMode

export function useReviewRanking(cycleId: string, roleId: string) {
  return useQuery({
    queryKey: queryKeys.reviewRanking.detail(cycleId, roleId),
    queryFn: () =>
      getReviewRanking(cycleId, { role_id: roleId }) as Promise<ReviewRanking>,
    enabled: !!cycleId && !!roleId,
  })
}

function useInvalidateRanking(cycleId: string, roleId: string) {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.reviewRanking.detail(cycleId, roleId),
    })
}

export function useSetCutoff(cycleId: string, roleId: string) {
  const invalidate = useInvalidateRanking(cycleId, roleId)
  return useMutation({
    mutationFn: async (vars: { mode: CutoffMode; value: number } | null) => {
      if (vars) await putReviewCutoff(cycleId, vars, { role_id: roleId })
      else await deleteReviewCutoff(cycleId, { role_id: roleId })
    },
    onSuccess: invalidate,
  })
}

export function useClearOverrides(cycleId: string, roleId: string) {
  const invalidate = useInvalidateRanking(cycleId, roleId)
  return useMutation({
    mutationFn: () => deleteReviewCutoffOverrides(cycleId, { role_id: roleId }),
    onSuccess: invalidate,
  })
}

export function useSetCutoffOverride(cycleId: string, roleId: string) {
  const invalidate = useInvalidateRanking(cycleId, roleId)
  return useMutation({
    mutationFn: async (vars: {
      applicationId: string
      included: boolean | null
    }) => {
      if (vars.included === null)
        await deleteReviewCutoffOverride(vars.applicationId)
      else
        await putReviewCutoffOverride(vars.applicationId, {
          included: vars.included,
        })
    },
    onSuccess: invalidate,
  })
}

export function useAdvanceShortlist(cycleId: string, roleId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: { applicationIds: string[] }) =>
      advanceShortlist(
        cycleId,
        { application_ids: vars.applicationIds },
        { role_id: roleId }
      ),
    onSuccess: () => {
      for (const key of [
        queryKeys.applications.all,
        queryKeys.reviewRanking.all,
        queryKeys.workflow.all,
      ])
        queryClient.invalidateQueries({ queryKey: key })
    },
  })
}
