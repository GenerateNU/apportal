'use client'

import { useState } from 'react'
import { Search, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { PersonCell } from '@/components/ui/person-cell'
import { SectionLabel } from '@/components/ui/section-label'
import { SegmentedTabs } from '@/components/ui/segmented-tabs'
import type { CycleStaffRole } from '@/generated/model'
import type { Cycle } from '@/lib/api/types'
import { useCycleStaff, useSetCycleStaff } from '@/lib/queries/cycle-staff'
import { useUsers } from '@/lib/queries/users'
import { STAFF_ROLE_LABEL, staffRolesFor } from '../lib/cycle-staff'
import { StaffRow } from './StaffRow'

const ROLE_ORDER: CycleStaffRole[] = ['chief', 'lead']
const MAX_RESULTS = 20

export function CycleStaffPanel({ cycle }: { cycle: Cycle }) {
  const roles = staffRolesFor(cycle.application_type)
  const { data: staff = [] } = useCycleStaff(cycle.id)
  const groups = ROLE_ORDER.map((role) => ({
    role,
    members: staff.filter((m) => m.role === role),
  })).filter((g) => g.members.length > 0)

  if (staff.length === 0) {
    return <EmptyState size="sm" title="No one is on this cycle yet." />
  }
  return (
    <div className="flex flex-col gap-6">
      {groups.map(({ role, members }) => (
        <section key={role} className="flex flex-col gap-2">
          <SectionLabel as="h3">{`${STAFF_ROLE_LABEL[role]}s · ${members.length}`}</SectionLabel>
          <ul
            aria-label={`${STAFF_ROLE_LABEL[role]}s`}
            className="divide-y divide-gray-100 border border-gray-200 bg-white"
          >
            {members.map((member) => (
              <StaffRow
                key={member.user_nuid}
                cycleId={cycle.id}
                applicationType={cycle.application_type}
                member={member}
                roles={roles}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

export function AddStaffButton({ cycle }: { cycle: Cycle }) {
  const roles = staffRolesFor(cycle.application_type)
  const [open, setOpen] = useState(false)
  if (roles.length === 0) return null
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4" />
        Add people
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add people</DialogTitle>
            <DialogDescription>
              Search by name or email, then add them to this cycle.
            </DialogDescription>
          </DialogHeader>
          {open && <AddStaff cycleId={cycle.id} roles={roles} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

function AddStaff({
  cycleId,
  roles,
}: {
  cycleId: string
  roles: CycleStaffRole[]
}) {
  const { data: users = [] } = useUsers()
  const { data: staff = [] } = useCycleStaff(cycleId)
  const setStaff = useSetCycleStaff()
  const [role, setRole] = useState<CycleStaffRole>(roles[roles.length - 1])
  const [query, setQuery] = useState('')

  const onStaff = new Set(staff.map((s) => s.user_nuid))
  const q = query.trim().toLowerCase()
  const matches = q
    ? users
        .filter(
          (u) =>
            !onStaff.has(u.nuid) &&
            (u.full_name.toLowerCase().includes(q) ||
              u.email.toLowerCase().includes(q))
        )
        .slice(0, MAX_RESULTS)
    : []

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search
            size={14}
            className="text-text-faint pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
          />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email"
            aria-label="Person to add"
            className="focus-visible:border-ink h-10 w-full border border-gray-300 bg-white pr-3 pl-9 text-sm outline-none"
          />
        </div>
        {roles.length > 1 ? (
          <SegmentedTabs<CycleStaffRole>
            className="h-10"
            tabs={roles.map((r) => ({
              id: r,
              label: `As ${STAFF_ROLE_LABEL[r]}`,
            }))}
            value={role}
            onChange={setRole}
          />
        ) : (
          <span className="text-text-muted text-sm">{`Added as ${STAFF_ROLE_LABEL[role]}`}</span>
        )}
      </div>

      <div className="max-h-80 overflow-y-auto">
        {!q ? (
          <p className="text-text-faint py-6 text-center text-sm">
            Start typing to find someone.
          </p>
        ) : matches.length === 0 ? (
          <p className="text-text-faint py-6 text-center text-sm">
            No one matches.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {matches.map((u) => (
              <li
                key={u.nuid}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <PersonCell name={u.full_name} secondary={u.email} />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={setStaff.isPending}
                  onClick={() =>
                    setStaff.mutate({ cycleId, nuid: u.nuid, role })
                  }
                >
                  Add
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {setStaff.error && (
        <p className="text-destructive text-sm">
          Couldn’t add them to this cycle.
        </p>
      )}
    </div>
  )
}
