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
import { Button } from '@/components/ui/button'
import type { User, UserRole } from '@/lib/api/types'
import { useUpdateUser } from '@/lib/queries/users'
import { REVIEWER_ACTOR } from '@/lib/stub-actor'
import { USER_ROLE_LABEL, USER_ROLE_ORDER } from '../lib/role-meta'

export function RoleEditDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User
}) {
  const updateUser = useUpdateUser()
  const [roles, setRoles] = useState<UserRole[]>(user.roles)

  function toggleRole(role: UserRole, checked: boolean) {
    setRoles((prev) =>
      checked ? [...prev, role] : prev.filter((r) => r !== role)
    )
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    updateUser.mutate(
      {
        nuid: user.nuid,
        body: { roles },
        opts: { actor: REVIEWER_ACTOR },
      },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setRoles(user.roles)
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Edit roles</DialogTitle>
            <DialogDescription>
              {user.full_name} — {user.email}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            {USER_ROLE_ORDER.map((role) => (
              <label
                key={role}
                className="text-text-secondary flex items-center gap-2.5 text-sm"
              >
                <input
                  type="checkbox"
                  checked={roles.includes(role)}
                  onChange={(e) => toggleRole(role, e.target.checked)}
                  className="accent-brand-blue h-4 w-4"
                />
                {USER_ROLE_LABEL[role]}
              </label>
            ))}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateUser.isPending}>
              {updateUser.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
