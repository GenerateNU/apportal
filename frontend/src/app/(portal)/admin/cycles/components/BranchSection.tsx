'use client'

import { useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Branch, Cycle, Role } from '@/lib/api/types'
import { BranchDialog } from './BranchDialog'
import { CycleDialog } from './CycleDialog'
import { CycleRow } from './CycleRow'

export function BranchSection({
  branch,
  cycles,
  roles,
}: {
  branch: Branch
  cycles: Cycle[]
  // Roles of this branch's cycles, in order.
  roles: Role[]
}) {
  const [showRename, setShowRename] = useState(false)
  const [showNewCycle, setShowNewCycle] = useState(false)

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="text-text-default truncate text-lg font-semibold">
            {branch.name}
          </h2>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Rename ${branch.name}`}
            onClick={() => setShowRename(true)}
          >
            <Pencil size={14} />
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => setShowNewCycle(true)}
        >
          <Plus className="h-4 w-4" />
          New cycle
        </Button>
      </div>

      {cycles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center">
          <p className="text-text-muted text-sm">
            No cycles in this branch yet.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {cycles.map((cycle) => (
            <CycleRow
              key={cycle.id}
              cycle={cycle}
              roles={roles.filter((r) => r.cycle_id === cycle.id)}
            />
          ))}
        </div>
      )}

      <BranchDialog
        open={showRename}
        onOpenChange={setShowRename}
        branch={branch}
      />
      <CycleDialog
        open={showNewCycle}
        onOpenChange={setShowNewCycle}
        branchId={branch.id}
      />
    </section>
  )
}
