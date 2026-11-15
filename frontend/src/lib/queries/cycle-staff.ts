import { useQuery } from '@tanstack/react-query'
import { listMyCycles } from '@/generated/cycle-staff/cycle-staff'
import type { CycleStaff } from '@/generated/model/cycleStaff'
import type { RequestOptions } from '@/lib/api/orval-mutator'
import { defaultPipelineCycleId } from '@/lib/cycles'
import { useBranches } from './branches'
import { useCycles } from './cycles'
import { queryKeys } from './keys'

export function useMyCycles(opts?: RequestOptions) {
  return useQuery({
    queryKey: queryKeys.cycleStaff.mine(),
    queryFn: async () => ((await listMyCycles(opts)) ?? []) as CycleStaff[],
  })
}

export function useOffCycle(isChief: boolean) {
  const { data: mine = [], isFetched } = useMyCycles()
  return !isChief && isFetched && mine.length === 0
}

export function useLeadCycle() {
  const { data: mine = [], isLoading } = useMyCycles()
  const { data: cycles = [] } = useCycles({})
  const { data: branches = [] } = useBranches()
  const staffed = mine.flatMap(
    (m) => cycles.find((c) => c.id === m.cycle_id) ?? []
  )
  const cycleId = defaultPipelineCycleId(staffed)
  const cycle = staffed.find((c) => c.id === cycleId)
  const branch = branches.find((b) => b.id === cycle?.branch_id)
  return { cycle, branch, isLoading }
}
