import { useQuery } from '@tanstack/react-query'
import { getCyclePipeline } from '@/generated/pipeline/pipeline'
import type { View } from '@/generated/model/view'
import { queryKeys } from './keys'

export function usePipeline(cycleId: string) {
  return useQuery({
    queryKey: queryKeys.pipeline.detail(cycleId),
    queryFn: async () => (await getCyclePipeline(cycleId)) as View,
    enabled: !!cycleId,
  })
}
