'use client'
import { PageContainer } from '@/components/PageContainer'

import { useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Cycle, CycleStatus } from '@/lib/api/types'
import { useCycles, useUpdateCycle } from '@/lib/queries/cycles'
import {
  APPLICATION_TYPE_LABEL,
  CYCLE_STATUS,
  CYCLE_STATUS_ORDER,
  type ApplicationType,
} from '../lib/cycle-meta'
import { CycleDialog } from './CycleDialog'

export function CyclesClient() {
  const { data: cycles = [] } = useCycles({})
  const [showCreate, setShowCreate] = useState(false)

  return (
    <PageContainer>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-text-default text-2xl font-semibold">Cycles</h1>
          <p className="text-text-muted mt-1 text-sm">
            Create recruiting cycles and open or close them for applicants.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          New cycle
        </Button>
      </div>

      {cycles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
          <p className="text-text-default text-sm font-medium">No cycles yet</p>
          <p className="text-text-muted mt-1 text-sm">
            Create one to start collecting applications.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {cycles.map((cycle) => (
            <CycleRow key={cycle.id} cycle={cycle} />
          ))}
        </div>
      )}

      <CycleDialog open={showCreate} onOpenChange={setShowCreate} />
    </PageContainer>
  )
}

function CycleRow({ cycle }: { cycle: Cycle }) {
  const updateCycle = useUpdateCycle()
  const [showEdit, setShowEdit] = useState(false)

  const status = CYCLE_STATUS[cycle.status]

  function changeStatus(next: CycleStatus) {
    if (next === cycle.status) return
    updateCycle.mutate({
      id: cycle.id,
      body: { status: next },
    })
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-text-default truncate text-sm font-semibold">
            {cycle.name}
          </span>
          <span className="text-text-muted rounded-md bg-gray-100 px-1.5 py-0.5 text-xs font-medium">
            {APPLICATION_TYPE_LABEL[
              cycle.application_type as ApplicationType
            ] ?? cycle.application_type}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${status.badge}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </span>

        <Select
          value={cycle.status}
          onValueChange={(val) => changeStatus(val as CycleStatus)}
          disabled={updateCycle.isPending}
        >
          <SelectTrigger className="w-32" aria-label="Change status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CYCLE_STATUS_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                {CYCLE_STATUS[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Edit cycle"
          onClick={() => setShowEdit(true)}
        >
          <Pencil size={14} />
        </Button>
      </div>

      <CycleDialog open={showEdit} onOpenChange={setShowEdit} cycle={cycle} />
    </div>
  )
}
