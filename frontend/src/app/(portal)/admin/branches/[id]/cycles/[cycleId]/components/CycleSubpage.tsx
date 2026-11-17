'use client'

import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { useBranches } from '@/lib/queries/branches'
import { useCycles } from '@/lib/queries/cycles'
import { branchCrumbs } from '../../../../lib/breadcrumbs'

export function useCycleCrumbs(
  branchId: string,
  cycleId: string,
  page: string
) {
  const { data: branches = [] } = useBranches()
  const { data: cycles = [] } = useCycles({ branch_id: branchId })
  const cycle = cycles.find((c) => c.id === cycleId)
  return {
    cycle,
    back: (
      <Breadcrumbs
        items={branchCrumbs({
          branchId,
          branch: branches.find((b) => b.id === branchId),
          cycleId,
          cycle,
          showCycle: true,
          page,
        })}
      />
    ),
  }
}
