'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { User } from '@/lib/api/types'
import { useSetReturner } from '@/lib/queries/users'
import { USER_ROLE_LABEL } from '../lib/role-meta'
import { RoleEditDialog } from './RoleEditDialog'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function ApplicantRow({
  user,
  gridCols,
}: {
  user: User
  gridCols: string
}) {
  const [showEdit, setShowEdit] = useState(false)
  const [confirmReturner, setConfirmReturner] = useState(false)
  const setReturner = useSetReturner()

  return (
    <>
      <div className={`grid ${gridCols} items-center gap-4 px-4 py-3`}>
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={user.full_name} size="sm" />
          <div className="min-w-0">
            <p className="text-text-default truncate text-sm font-semibold">
              {user.full_name}
            </p>
            <p className="text-text-subtle truncate text-xs">{user.email}</p>
          </div>
        </div>

        <span className="text-text-secondary text-sm">
          {formatDate(user.created_at)}
        </span>

        <button
          type="button"
          onClick={() => setShowEdit(true)}
          aria-label="Edit roles"
          className="text-text-secondary flex w-fit items-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm hover:border-gray-300 hover:bg-gray-50"
        >
          {USER_ROLE_LABEL['applicant']}
          <ChevronDown className="text-text-faint h-3.5 w-3.5" />
        </button>

        {/* Confirmed before it's applied: the flag follows the person across
            every cycle, so a stray click is not a local mistake. The box only
            ticks once the mutation's optimistic update lands. */}
        <Checkbox
          checked={user.returner}
          disabled={setReturner.isPending}
          onCheckedChange={() => setConfirmReturner(true)}
          aria-label={`Mark ${user.full_name} as a returner`}
        />

        <Dialog open={confirmReturner} onOpenChange={setConfirmReturner}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {user.returner ? 'Unmark returner?' : 'Mark as returner?'}
              </DialogTitle>
              <DialogDescription>
                {user.returner
                  ? `${user.full_name} will stop showing the returner badge on every application they have, in this cycle and future ones.`
                  : `${user.full_name} will show the returner badge on every application they have, in this cycle and future ones.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirmReturner(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setReturner.mutate({
                    nuid: user.nuid,
                    returner: !user.returner,
                  })
                  setConfirmReturner(false)
                }}
              >
                {user.returner ? 'Unmark' : 'Mark as returner'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <RoleEditDialog
          open={showEdit}
          onOpenChange={setShowEdit}
          user={user}
        />
      </div>
    </>
  )
}
