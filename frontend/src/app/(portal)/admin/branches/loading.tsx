'use client'

import { usePathname } from 'next/navigation'
import { PageLoading } from '@/components/PageLoading'
import { useBranches } from '@/lib/queries/branches'
import { useCycles } from '@/lib/queries/cycles'
import { useRoles } from '@/lib/queries/roles'
import { branchCrumbs, branchPathIds } from './lib/breadcrumbs'

export default function BranchesLoading() {
  const { branchId, cycleId, roleId } = branchPathIds(usePathname())
  const { data: branches = [] } = useBranches()
  const { data: cycles = [] } = useCycles({ branch_id: branchId })
  const { data: roles = [] } = useRoles()

  const crumbs = branchCrumbs({
    branchId,
    branch: branches.find((b) => b.id === branchId),
    cycleId,
    cycle: cycles.find((c) => c.id === cycleId),
    showCycle: !!cycleId,
    formLabel: roleId
      ? (roles.find((r) => r.id === roleId)?.name ?? 'Application')
      : undefined,
  })

  return <PageLoading crumbs={crumbs} />
}
