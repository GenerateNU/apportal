import { useBranches } from '@/lib/queries/branches'
import { useStaffCycles } from '@/lib/queries/cycle-staff'

export function useBranchName(cycleId: string) {
  const { data: cycles = [] } = useStaffCycles()
  const { data: branches = [] } = useBranches()
  const branchId = cycles.find((c) => c.id === cycleId)?.branch_id
  return branches.find((b) => b.id === branchId)?.name ?? ''
}
