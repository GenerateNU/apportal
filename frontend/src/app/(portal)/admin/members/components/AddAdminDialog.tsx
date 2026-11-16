'use client'

import { useMemo, useState } from 'react'
import { Check, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { PersonCell } from '@/components/ui/person-cell'
import { SearchInput } from '@/components/ui/search-input'
import type { User } from '@/lib/api/types'
import { useUpdateUser, useUsers } from '@/lib/queries/users'
import { isAdmin, withAdmin } from '../lib/role-meta'

export function AddAdminDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  // Every account, not the paged table's, so anyone can be promoted.
  const { data: users = [] } = useUsers()
  const updateUser = useUpdateUser()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<User[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const results = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return []
    return users
      .filter(
        (u) =>
          !isAdmin(u.roles) &&
          (u.full_name.toLowerCase().includes(query) ||
            u.email.toLowerCase().includes(query))
      )
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
      .slice(0, 8)
  }, [users, search])

  function reset() {
    setSearch('')
    setSelected([])
  }

  function toggle(user: User) {
    setSelected((prev) =>
      prev.some((u) => u.nuid === user.nuid)
        ? prev.filter((u) => u.nuid !== user.nuid)
        : [...prev, user]
    )
  }

  async function handleSubmit() {
    if (selected.length === 0) return
    setIsSubmitting(true)
    try {
      await Promise.all(
        selected.map((u) =>
          updateUser.mutateAsync({
            nuid: u.nuid,
            body: { roles: withAdmin(u.roles) },
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
        <div className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Add admins</DialogTitle>
            <DialogDescription>
              Admins can manage every branch, cycle and member.
            </DialogDescription>
          </DialogHeader>

          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by name or email…"
            className="sm:w-full"
          />

          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selected.map((u) => (
                <span
                  key={u.nuid}
                  className="bg-muted text-text-secondary flex items-center gap-1 py-1 pr-1.5 pl-2.5 text-xs"
                >
                  {u.full_name}
                  <button
                    type="button"
                    onClick={() => toggle(u)}
                    aria-label={`Remove ${u.full_name}`}
                    className="hover:text-text-default -m-1 p-1"
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
                  const isSelected = selected.some((s) => s.nuid === u.nuid)
                  return (
                    <button
                      key={u.nuid}
                      type="button"
                      onClick={() => toggle(u)}
                      aria-pressed={isSelected ? 'true' : 'false'}
                      className={`px-2 py-2 text-left hover:bg-gray-50 ${
                        isSelected ? 'bg-gray-50' : ''
                      }`}
                    >
                      <PersonCell
                        name={u.full_name}
                        secondary={u.email}
                        trailing={
                          isSelected && (
                            <Check className="text-ink ml-auto h-4 w-4 shrink-0" />
                          )
                        }
                      />
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
              disabled={isSubmitting || selected.length === 0}
              onClick={handleSubmit}
            >
              {isSubmitting
                ? 'Adding…'
                : selected.length > 1
                  ? `Make ${selected.length} admins`
                  : 'Make admin'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
