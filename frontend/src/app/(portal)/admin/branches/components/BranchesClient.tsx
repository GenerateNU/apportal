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
import { BranchDialog } from '../../cycles/components/BranchDialog'
import { groupCyclesByBranch } from '../../cycles/lib/group-cycles'
import { branchCrumbs } from '../lib/breadcrumbs'
import { BranchCard } from './BranchCard'

export function BranchesClient() {
  const { data: branches = [] } = useBranches()
  const { data: cycles = [] } = useCycles({})
  const { data: roles = [] } = useRoles()
  const [showCreate, setShowCreate] = useState(false)

  const groups = groupCyclesByBranch(branches, cycles)

  return (
    <PageContainer>
      <PageHeader
        back={<Breadcrumbs items={branchCrumbs({})} />}
        title="Branches"
        subtitle="Pick a branch to see its open, draft and closed cycles."
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            New branch
          </Button>
        }
      />

      {groups.length === 0 ? (
        <EmptyState
          title="No branches yet"
          description="Create a branch to start adding cycles."
        />
      ) : (
        <div className="flex flex-col gap-10">
          {groups.map(({ branch, cycles }, i) => (
            <BranchCard
              key={branch.id}
              branch={branch}
              cycles={cycles}
              roles={roles}
              colorIndex={i}
            />
          ))}
        </div>
      )}

      <BranchDialog open={showCreate} onOpenChange={setShowCreate} />
    </PageContainer>
  )
}
