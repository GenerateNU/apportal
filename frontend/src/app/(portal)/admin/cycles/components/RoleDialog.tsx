'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
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
import { APIError } from '@/lib/api/client'
import type { Role } from '@/lib/api/types'
import {
  useCreateRole,
  useDeleteRole,
  useUpdateRole,
} from '@/lib/queries/roles'

// Creates a role in a cycle, or renames/deletes an existing one.
export function RoleDialog({
  open,
  onOpenChange,
  cycleId,
  role,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cycleId: string
  role?: Role
}) {
  const isEdit = !!role
  const createRole = useCreateRole()
  const updateRole = useUpdateRole()
  const deleteRole = useDeleteRole()

  const [name, setName] = useState(role?.name ?? '')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const pending =
    createRole.isPending || updateRole.isPending || deleteRole.isPending
  const saveError = createRole.error ?? updateRole.error

  function close() {
    setConfirmingDelete(false)
    deleteRole.reset()
    onOpenChange(false)
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    const onSuccess = () => {
      if (!isEdit) setName('')
      close()
    }

    if (isEdit) {
      updateRole.mutate({ id: role.id, body: { name: trimmed } }, { onSuccess })
    } else {
      createRole.mutate(
        { body: { cycle_id: cycleId, name: trimmed } },
        { onSuccess }
      )
    }
  }

  function handleDelete() {
    if (!role) return
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    deleteRole.mutate({ id: role.id }, { onSuccess: close })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : close())}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit role' : 'New role'}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? 'Renaming keeps every application and template attached.'
                : 'Applicants to this cycle pick one of its roles.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-name">Role name</Label>
            <Input
              id="role-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Software Engineer"
            />
            {saveError && (
              <p className="text-destructive text-sm">
                Couldn’t save — this cycle may already have a role with this
                name.
              </p>
            )}
            {deleteRole.error && (
              <p className="text-destructive text-sm">
                {deleteRole.error instanceof APIError &&
                deleteRole.error.status === 409
                  ? 'This role is still used by applications, templates or questions, so it can’t be deleted.'
                  : 'Couldn’t delete this role.'}
              </p>
            )}
          </div>

          <DialogFooter className="sm:justify-between">
            {isEdit ? (
              <Button
                type="button"
                variant={confirmingDelete ? 'destructive' : 'ghost'}
                disabled={pending}
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4" />
                {confirmingDelete ? 'Confirm delete' : 'Delete role'}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim() || pending}>
                {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create role'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
