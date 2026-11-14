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
import type { Branch } from '@/lib/api/types'
import { useCreateBranch, useUpdateBranch } from '@/lib/queries/branches'

export function BranchDialog({
  open,
  onOpenChange,
  branch,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  branch?: Branch
}) {
  const isEdit = !!branch
  const createBranch = useCreateBranch()
  const updateBranch = useUpdateBranch()

  const [name, setName] = useState(branch?.name ?? '')
  const pending = createBranch.isPending || updateBranch.isPending
  const error = createBranch.error ?? updateBranch.error

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    const onSuccess = () => {
      if (!isEdit) setName('')
      onOpenChange(false)
    }

    if (isEdit) {
      updateBranch.mutate(
        { id: branch.id, body: { name: trimmed } },
        { onSuccess }
      )
    } else {
      createBranch.mutate({ body: { name: trimmed } }, { onSuccess })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Rename branch' : 'New branch'}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? 'Rename this branch. Its cycles stay under it.'
                : 'Create a branch to group its recruiting cycles.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="branch-name">Branch name</Label>
            <Input
              id="branch-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Software"
            />
            {error && (
              <p className="text-destructive text-sm">
                Couldn’t save — a branch with this name may already exist.
              </p>
            )}
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
              {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create branch'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
