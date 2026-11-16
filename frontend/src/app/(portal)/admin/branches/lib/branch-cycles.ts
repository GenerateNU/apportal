import type { Cycle, CycleStatus, Role } from '@/lib/api/types'

export const BRANCH_CYCLE_STATUSES = ['open', 'draft', 'closed'] as const

export type BranchCycleStatus = (typeof BRANCH_CYCLE_STATUSES)[number]

// Archived cycles are left out.
export function groupCyclesByStatus(
  cycles: Cycle[]
): Record<BranchCycleStatus, Cycle[]> {
  const groups: Record<BranchCycleStatus, Cycle[]> = {
    open: [],
    draft: [],
    closed: [],
  }
  for (const cycle of cycles) {
    if (isBranchCycleStatus(cycle.status)) groups[cycle.status].push(cycle)
  }
  return groups
}

function isBranchCycleStatus(status: CycleStatus): status is BranchCycleStatus {
  return (BRANCH_CYCLE_STATUSES as readonly string[]).includes(status)
}

// Unique role names across a branch's non-archived cycles, A–Z.
export function branchRoleNames(cycles: Cycle[], roles: Role[]): string[] {
  const cycleIds = new Set(
    cycles.filter((c) => c.status !== 'archived').map((c) => c.id)
  )
  const names = new Set(
    roles.filter((r) => cycleIds.has(r.cycle_id)).map((r) => r.name)
  )
  return [...names].sort((a, b) => a.localeCompare(b))
}
