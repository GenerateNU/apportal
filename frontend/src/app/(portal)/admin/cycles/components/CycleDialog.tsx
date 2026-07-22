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
import type { Cycle } from '@/lib/api/types'
import { useCreateCycle, useUpdateCycle } from '@/lib/queries/cycles'
import { REVIEWER_ACTOR } from '@/lib/stub-actor'
import { APPLICATION_TYPES, type ApplicationType } from '../lib/cycle-meta'

const SELECT_CLASS =
  'border-input focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm outline-none focus-visible:ring-3'

export function CycleDialog({
  open,
  onOpenChange,
  cycle,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cycle?: Cycle
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
    const opts = { actor: REVIEWER_ACTOR }
    const onSuccess = () => onOpenChange(false)

    if (isEdit) {
      updateCycle.mutate({ id: cycle.id, body, opts }, { onSuccess })
    } else {
      createCycle.mutate({ body, opts }, { onSuccess })
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
                : 'Create a recruiting cycle. It starts as a draft — open it when applications should go live.'}
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
            <select
              id="cycle-type"
              aria-label="Application type"
              className={SELECT_CLASS}
              value={applicationType}
              onChange={(e) =>
                setApplicationType(e.target.value as ApplicationType)
              }
            >
              {APPLICATION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
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
