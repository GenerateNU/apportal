'use client'

import { useState } from 'react'
import { Plus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { SectionLabel } from '@/components/ui/section-label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CycleStaffRole } from '@/generated/model'
import type { Cycle } from '@/lib/api/types'
import { useCycleStaff, useSetCycleStaff } from '@/lib/queries/cycle-staff'
import { useUsers } from '@/lib/queries/users'
import {
  STAFF_ROLE_LABEL,
  staffHelpText,
  staffRolesFor,
} from '../lib/cycle-staff'
import { StaffRow } from './StaffRow'

export function CycleStaffButton({ cycle }: { cycle: Cycle }) {
  const [open, setOpen] = useState(false)
  const { data: staff = [] } = useCycleStaff(cycle.id)

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Users className="h-4 w-4" />
        {`Leads & chiefs · ${staff.length}`}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Leads &amp; chiefs</DialogTitle>
            <DialogDescription>
              {staffHelpText(cycle.application_type)}
            </DialogDescription>
          </DialogHeader>
          <CycleStaffPanel cycle={cycle} />
        </DialogContent>
      </Dialog>
    </>
  )
}

export function CycleStaffPanel({ cycle }: { cycle: Cycle }) {
  const roles = staffRolesFor(cycle.application_type)
  const { data: staff = [] } = useCycleStaff(cycle.id)

  return (
    <div className="flex flex-col gap-5">
      {roles.length > 0 && (
        <div className="flex flex-col gap-2">
          <SectionLabel as="h3">Add someone</SectionLabel>
          <AddStaffForm cycleId={cycle.id} roles={roles} />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <SectionLabel as="h3">{`On this cycle · ${staff.length}`}</SectionLabel>
        {staff.length === 0 ? (
          <EmptyState size="sm" title="No one is on this cycle yet." />
        ) : (
          <ul
            aria-label="Leads and chiefs"
            className="border-ink divide-y divide-gray-200 border-2 bg-white"
          >
            {staff.map((member) => (
              <StaffRow
                key={member.user_nuid}
                cycleId={cycle.id}
                applicationType={cycle.application_type}
                member={member}
                roles={roles}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function AddStaffForm({
  cycleId,
  roles,
}: {
  cycleId: string
  roles: CycleStaffRole[]
}) {
  const { data: users = [] } = useUsers()
  const { data: staff = [] } = useCycleStaff(cycleId)
  const setStaff = useSetCycleStaff()
  const [nuid, setNuid] = useState('')
  const [role, setRole] = useState<CycleStaffRole>(roles[roles.length - 1])

  const onStaff = new Set(staff.map((s) => s.user_nuid))
  const options = users
    .filter((u) => !onStaff.has(u.nuid))
    .map((u) => ({ value: u.nuid, label: `${u.full_name} · ${u.email}` }))

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!nuid) return
    setStaff.mutate({ cycleId, nuid, role }, { onSuccess: () => setNuid('') })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"
    >
      <SearchableSelect
        options={options}
        value={nuid}
        onValueChange={setNuid}
        placeholder="Choose a person"
        searchPlaceholder="Search by name or email"
        emptyText="No one matches."
        ariaLabel="Person to add"
        className="col-span-2 w-full min-w-0"
      />
      {roles.length > 1 ? (
        <Select
          value={role}
          onValueChange={(val) => setRole(val as CycleStaffRole)}
        >
          <SelectTrigger className="w-full" aria-label="Role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r} value={r}>
                {STAFF_ROLE_LABEL[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <span className="text-ink flex h-9 items-center border border-gray-200 bg-gray-50 px-3 text-sm font-semibold">
          {`as ${STAFF_ROLE_LABEL[role]}`}
        </span>
      )}
      <Button type="submit" disabled={!nuid || setStaff.isPending}>
        <Plus className="h-4 w-4" />
        {setStaff.isPending ? 'Adding…' : 'Add'}
      </Button>
      {setStaff.error && (
        <p className="text-destructive col-span-2 text-sm">
          Couldn’t add them to this cycle.
        </p>
      )}
    </form>
  )
}
