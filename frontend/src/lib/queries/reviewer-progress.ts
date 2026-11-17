import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listReviewerProgress } from '@/generated/review-releases/review-releases'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import type { ReviewerProgress } from '@/lib/api/types'
import { queryKeys } from './keys'

export function useReviewerProgressByRoles(
  cycleId: string,
  roleIds: string[],
  opts?: RequestOptions
) {
  const queryClient = useQueryClient()
  const q = useQuery({
    queryKey: [...queryKeys.reviewerProgress.lists(), cycleId, roleIds],
    queryFn: async () => {
      const data =
        (await listReviewerProgress(
          cycleId,
          { role_ids: roleIds.join(',') },
          opts
        )) ?? []
      const byRole: Record<string, ReviewerProgress[]> = {}
      for (const roleId of roleIds) {
        byRole[roleId] = data.map((p) => ({
          ...p,
          items: (p.items ?? []).filter((i) => i.role_id === roleId),
        })) as ReviewerProgress[]
        queryClient.setQueryData(
          queryKeys.reviewerProgress.list(cycleId, roleId),
          byRole[roleId]
        )
      }
      return byRole
    },
    enabled: !!cycleId && roleIds.length > 0,
  })
  return useMemo(
    () =>
      roleIds.map((roleId) => ({
        data: q.data?.[roleId],
        isLoading: q.isLoading,
      })),
    [roleIds, q.data, q.isLoading]
  )
}
