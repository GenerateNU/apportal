import { useQuery } from '@tanstack/react-query'
import { listMyCycles } from '@/generated/cycle-staff/cycle-staff'
import type { CycleStaff } from '@/generated/model/cycleStaff'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import { queryKeys } from './keys'

export function useMyCycles(opts?: RequestOptions) {
  return useQuery({
    queryKey: queryKeys.cycleStaff.mine(),
    queryFn: async () => ((await listMyCycles(opts)) ?? []) as CycleStaff[],
  })
}
