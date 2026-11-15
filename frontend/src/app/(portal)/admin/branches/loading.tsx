'use client'

import { usePathname } from 'next/navigation'
import { PageContainer } from '@/components/PageContainer'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { useBranches } from '@/lib/queries/branches'
import { useCycles } from '@/lib/queries/cycles'
import { useRoles } from '@/lib/queries/roles'
import { branchCrumbs, branchPathIds } from './lib/breadcrumbs'

// Keeps the crumbs where the page will draw them, so they don't jump while
// the next page loads.
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

  return (
    <PageContainer>
      <Breadcrumbs items={crumbs} />
      <div
        role="status"
        aria-label="Loading"
        className="border-text-faint border-t-primary mx-auto mt-16 size-8 animate-spin rounded-full border-4"
      />
    </PageContainer>
  )
}
