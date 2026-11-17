'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PersonCell } from '@/components/ui/person-cell'
import { TABLE_ROW } from '@/components/ui/table-styles'
import type { User } from '@/lib/api/types'
import { useCurrentUser, useUpdateUser } from '@/lib/queries/users'
import { cn } from '@/lib/utils'
import { withoutAdmin } from '../lib/role-meta'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function MemberRow({
  user,
  gridCols,
}: {
  user: User
  gridCols: string
}) {
  const { data: me } = useCurrentUser()
  const updateUser = useUpdateUser()
  const [confirming, setConfirming] = useState(false)
  // Removing yourself would lock you out of this page.
  const isSelf = me?.nuid === user.nuid

  return (
    <div className={cn('grid items-center gap-4', gridCols, TABLE_ROW)}>
      <PersonCell name={user.full_name} secondary={user.email} />

      <span className="text-text-secondary hidden text-sm sm:block">
        {formatDate(user.created_at)}
      </span>

      <Button
        variant="outline"
        size="sm"
        className="justify-self-end"
        disabled={isSelf}
        title={isSelf ? 'You can’t remove yourself' : undefined}
        onClick={() => setConfirming(true)}
      >
        Remove
      </Button>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Remove ${user.full_name} as admin?`}
        description="They keep any lead or chief spots on cycles."
        confirmLabel="Remove"
        pending={updateUser.isPending}
        onConfirm={() =>
          updateUser.mutate(
            { nuid: user.nuid, body: { roles: withoutAdmin(user.roles) } },
            { onSuccess: () => setConfirming(false) }
          )
        }
      />
    </div>
  )
}
