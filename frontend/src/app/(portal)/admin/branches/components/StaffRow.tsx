'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PersonCell } from '@/components/ui/person-cell'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CycleStaffMember, CycleStaffRole } from '@/generated/model'
import {
  useRemoveCycleStaff,
  useSetCycleStaff,
} from '@/lib/queries/cycle-staff'
import { STAFF_ROLE_LABEL } from '../lib/cycle-staff'

export function StaffRow({
  cycleId,
  applicationType,
  member,
  roles,
}: {
  cycleId: string
  applicationType: string
  member: CycleStaffMember
  // Roles this cycle allows; a role outside them can only be removed.
  roles: CycleStaffRole[]
}) {
  const setStaff = useSetCycleStaff()
  const removeStaff = useRemoveCycleStaff()
  const [confirming, setConfirming] = useState(false)
  // Left over from before the cycle's type changed; they can see nothing.
  const noAccess = !roles.includes(member.role)
  const canChange = roles.length > 1 && !noAccess

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5">
      <PersonCell
        name={member.full_name}
        secondary={
          noAccess ? (
            <span className="text-destructive font-medium">
              {`No access: ${STAFF_ROLE_LABEL[member.role].toLowerCase()}s can’t see ${applicationType} cycles`}
            </span>
          ) : (
            member.email
          )
        }
      />
      <div className="flex shrink-0 items-center gap-2">
        {canChange ? (
          <Select
            value={member.role}
            onValueChange={(role) =>
              setStaff.mutate({
                cycleId,
                nuid: member.user_nuid,
                role: role as CycleStaffRole,
              })
            }
            disabled={setStaff.isPending}
          >
            <SelectTrigger
              className="h-8 w-24 text-sm"
              aria-label={`Role for ${member.full_name}`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role} value={role}>
                  {STAFF_ROLE_LABEL[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-ink px-2 text-sm font-semibold">
            {STAFF_ROLE_LABEL[member.role]}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${member.full_name}`}
          onClick={() => setConfirming(true)}
        >
          <Trash2 size={14} />
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Remove ${member.full_name}?`}
        description={`They lose their ${STAFF_ROLE_LABEL[member.role].toLowerCase()} access to this cycle.`}
        confirmLabel="Remove"
        pending={removeStaff.isPending}
        onConfirm={() =>
          removeStaff.mutate(
            { cycleId, nuid: member.user_nuid },
            { onSuccess: () => setConfirming(false) }
          )
        }
      />
    </li>
  )
}
