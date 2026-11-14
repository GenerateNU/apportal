'use client'
import { PageContainer } from '@/components/PageContainer'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { useBranches } from '@/lib/queries/branches'
import { useCycles } from '@/lib/queries/cycles'
import { useRoles } from '@/lib/queries/roles'
import { groupCyclesByBranch } from '../lib/group-cycles'
import { BranchDialog } from './BranchDialog'
import { BranchSection } from './BranchSection'

export function CyclesClient() {
  const { data: branches = [] } = useBranches()
  const { data: cycles = [] } = useCycles({})
  const { data: roles = [] } = useRoles()
  const [showCreate, setShowCreate] = useState(false)

  const groups = groupCyclesByBranch(branches, cycles)

  return (
    <PageContainer>
      <PageHeader
        title="Branches & cycles"
        subtitle="Create branches, the roles they recruit for and the cycles under them, and open or close cycles for applicants."
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
          description="Create a branch, then add cycles to it."
        />
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map(({ branch, cycles }) => (
            <BranchSection
              key={branch.id}
              branch={branch}
              cycles={cycles}
              roles={roles}
            />
          ))}
        </div>
      )}

      <BranchDialog open={showCreate} onOpenChange={setShowCreate} />
    </PageContainer>
  )
}
