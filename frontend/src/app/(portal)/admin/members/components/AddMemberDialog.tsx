'use client'

import { useMemo, useState } from 'react'
import { Check, Search, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import type { User, UserRole } from '@/lib/api/types'
import { useUpdateUser, useUsers } from '@/lib/queries/users'
import { REVIEWER_ACTOR } from '@/lib/stub-actor'
import { STAFF_ROLES, USER_ROLE_LABEL } from '../lib/role-meta'

type Step = 'search' | 'roles'

export function AddMemberDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  // Unfiltered, unpaginated — unlike the Members table this needs every
  // account (applicants included) so staff can be promoted from the pool.
  const { data: users = [] } = useUsers(undefined, { actor: REVIEWER_ACTOR })
  const updateUser = useUpdateUser()
  const [step, setStep] = useState<Step>('search')
  const [search, setSearch] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<UserRole[]>(['member'])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const results = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return []
    return users
      .filter(
        (u) =>
          u.full_name.toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query)
      )
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
      .slice(0, 8)
  }, [users, search])

  function reset() {
    setStep('search')
    setSearch('')
    setSelectedUsers([])
    setRoles(['member'])
  }

  function toggleUser(user: User) {
    setSelectedUsers((prev) =>
      prev.some((u) => u.nuid === user.nuid)
        ? prev.filter((u) => u.nuid !== user.nuid)
        : [...prev, user]
    )
  }

  function toggleRole(role: UserRole, checked: boolean) {
    setRoles((prev) =>
      checked ? [...prev, role] : prev.filter((r) => r !== role)
    )
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (selectedUsers.length === 0 || roles.length === 0) return
    setIsSubmitting(true)
    try {
      await Promise.all(
        selectedUsers.map((u) =>
          updateUser.mutateAsync({
            nuid: u.nuid,
            body: { roles },
            opts: { actor: REVIEWER_ACTOR },
          })
        )
      )
      onOpenChange(false)
      reset()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent>
        {step === 'roles' ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Add to staff</DialogTitle>
              <DialogDescription>
                Assigning a role to {selectedUsers.length}{' '}
                {selectedUsers.length === 1 ? 'user' : 'users'}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap gap-1.5">
              {selectedUsers.map((u) => (
                <span
                  key={u.nuid}
                  className="bg-muted text-text-secondary flex items-center gap-1 rounded-full py-1 pr-1.5 pl-2.5 text-xs"
                >
                  {u.full_name}
                  <button
                    type="button"
                    onClick={() => toggleUser(u)}
                    aria-label={`Remove ${u.full_name}`}
                    className="hover:text-text-default"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              {STAFF_ROLES.map((role) => (
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
                onClick={() => setStep('search')}
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  selectedUsers.length === 0 ||
                  roles.length === 0
                }
              >
                {isSubmitting ? 'Adding…' : 'Add'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Add users</DialogTitle>
              <DialogDescription>
                Search for users to assign a staff role to.
              </DialogDescription>
            </DialogHeader>

            <div className="relative">
              <Search className="text-text-faint pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="focus:border-brand-blue focus:ring-brand-blue w-full rounded-lg border border-gray-300 py-2 pr-3 pl-9 text-sm outline-none focus:ring-1"
              />
            </div>

            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedUsers.map((u) => (
                  <span
                    key={u.nuid}
                    className="bg-muted text-text-secondary flex items-center gap-1 rounded-full py-1 pr-1.5 pl-2.5 text-xs"
                  >
                    {u.full_name}
                    <button
                      type="button"
                      onClick={() => toggleUser(u)}
                      aria-label={`Remove ${u.full_name}`}
                      className="hover:text-text-default"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {search.trim() && (
              <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
                {results.length === 0 ? (
                  <p className="text-text-faint px-1 py-2 text-sm">
                    No users found
                  </p>
                ) : (
                  results.map((u) => {
                    const isSelected = selectedUsers.some(
                      (s) => s.nuid === u.nuid
                    )
                    return (
                      <button
                        key={u.nuid}
                        type="button"
                        onClick={() => toggleUser(u)}
                        aria-pressed={isSelected ? 'true' : 'false'}
                        className={`flex items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-gray-50 ${
                          isSelected ? 'bg-gray-50' : ''
                        }`}
                      >
                        <Avatar name={u.full_name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="text-text-default truncate text-sm font-medium">
                            {u.full_name}
                          </p>
                          <p className="text-text-subtle truncate text-xs">
                            {u.email}
                          </p>
                        </div>
                        {isSelected && (
                          <Check className="text-brand-blue h-4 w-4 shrink-0" />
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={selectedUsers.length === 0}
                onClick={() => setStep('roles')}
              >
                Continue
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
