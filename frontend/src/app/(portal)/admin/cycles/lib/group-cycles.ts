import type { Branch, Cycle } from '@/lib/api/types'

export type BranchGroup = { branch: Branch; cycles: Cycle[] }

export function groupCyclesByBranch(
  branches: Branch[],
  cycles: Cycle[]
): BranchGroup[] {
  const byBranch = new Map<string, Cycle[]>(branches.map((b) => [b.id, []]))
  for (const cycle of cycles) byBranch.get(cycle.branch_id)?.push(cycle)
  return branches.map((branch) => ({
    branch,
    cycles: byBranch.get(branch.id) ?? [],
  }))
}
