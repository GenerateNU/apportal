'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Cycle } from '@/lib/api/types'
import { useCreateCycle, useUpdateCycle } from '@/lib/queries/cycles'
import { APPLICATION_TYPES, type ApplicationType } from '../lib/cycle-meta'

// Pass `cycle` to edit, or `branchId` to create a cycle in that branch.
export function CycleDialog({
  open,
  onOpenChange,
  cycle,
  branchId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cycle?: Cycle
  branchId?: string
}) {
  const isEdit = !!cycle
  const createCycle = useCreateCycle()
  const updateCycle = useUpdateCycle()

  const [name, setName] = useState(cycle?.name ?? '')
  const [applicationType, setApplicationType] = useState<ApplicationType>(
    (cycle?.application_type as ApplicationType) ?? 'member'
  )
  const pending = createCycle.isPending || updateCycle.isPending

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    const body = {
      name: trimmed,
      application_type: applicationType,
    }
    const onSuccess = () => onOpenChange(false)

    if (isEdit) {
      updateCycle.mutate({ id: cycle.id, body }, { onSuccess })
    } else if (branchId) {
      createCycle.mutate(
        { body: { ...body, branch_id: branchId } },
        { onSuccess }
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit cycle' : 'New cycle'}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? 'Update this recruiting cycle.'
                : 'Create a recruiting cycle. It starts as a draft with the roles of this branch’s latest cycle of the same type — edit them on the cycle, and open it when applications should go live.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cycle-name">Cycle name</Label>
            <Input
              id="cycle-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Fall 2026"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cycle-type">Application type</Label>
            <Select
              value={applicationType}
              onValueChange={(val) =>
                setApplicationType(val as ApplicationType)
              }
            >
              <SelectTrigger id="cycle-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APPLICATION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || pending}>
              {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create cycle'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
