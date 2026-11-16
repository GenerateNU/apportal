'use client'

import { useState } from 'react'
import { PersonCell } from '@/components/ui/person-cell'
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
import { TABLE_ROW } from '@/components/ui/table-styles'
import type { User } from '@/lib/api/types'
import { cn } from '@/lib/utils'
import { useSetReturner } from '@/lib/queries/users'
import { isAdmin } from '../lib/role-meta'

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
  const [confirmReturner, setConfirmReturner] = useState(false)
  const setReturner = useSetReturner()

  return (
    <>
      <div className={cn('grid items-center gap-4', gridCols, TABLE_ROW)}>
        <PersonCell name={user.full_name} secondary={user.email} />

        <span className="text-text-secondary hidden text-sm sm:block">
          {formatDate(user.created_at)}
        </span>

        <span className="text-text-secondary text-sm">
          {isAdmin(user.roles) ? 'Admin' : 'Applicant'}
        </span>

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
      </div>
    </>
  )
}
