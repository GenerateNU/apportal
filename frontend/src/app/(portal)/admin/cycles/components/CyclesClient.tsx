'use client'
import { PageContainer } from '@/components/PageContainer'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-text-default text-2xl font-semibold">
            Branches & cycles
          </h1>
          <p className="text-text-muted mt-1 text-sm">
            Create branches, the roles they recruit for and the cycles under
            them, and open or close cycles for applicants.
          </p>
        </div>
        <Button className="shrink-0" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          New branch
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
          <p className="text-text-default text-sm font-medium">
            No branches yet
          </p>
          <p className="text-text-muted mt-1 text-sm">
            Create a branch, then add cycles to it.
          </p>
        </div>
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
