'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { PageContainer } from '@/components/PageContainer'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { useBranches } from '@/lib/queries/branches'
import { useCycles } from '@/lib/queries/cycles'
import { useRoles } from '@/lib/queries/roles'
import { CycleDialog } from '../../../cycles/components/CycleDialog'
import { CycleStatusList } from '../../components/CycleStatusList'
import {
  BRANCH_CYCLE_STATUSES,
  groupCyclesByStatus,
} from '../../lib/branch-cycles'
import { branchCrumbs } from '../../lib/breadcrumbs'

export function BranchDetailClient({ branchId }: { branchId: string }) {
  const { data: branches = [] } = useBranches()
  const { data: cycles = [] } = useCycles({ branch_id: branchId })
  const { data: roles = [] } = useRoles()
  const [showNewCycle, setShowNewCycle] = useState(false)

  const branch = branches.find((b) => b.id === branchId)
  const back = <Breadcrumbs items={branchCrumbs({ branchId, branch })} />

  if (!branch) {
    return (
      <PageContainer>
        {back}
        <EmptyState title="Branch not found" />
      </PageContainer>
    )
  }

  const groups = groupCyclesByStatus(cycles)

  return (
    <PageContainer>
      <PageHeader
        back={back}
        title={branch.name}
        actions={
          <Button onClick={() => setShowNewCycle(true)}>
            <Plus className="h-4 w-4" />
            New cycle
          </Button>
        }
      />

      <div className="flex flex-col gap-8">
        {BRANCH_CYCLE_STATUSES.map((status) => (
          <CycleStatusList
            key={status}
            status={status}
            cycles={groups[status]}
            roles={roles}
          />
        ))}
      </div>

      <CycleDialog
        open={showNewCycle}
        onOpenChange={setShowNewCycle}
        branchId={branch.id}
      />
    </PageContainer>
  )
}
