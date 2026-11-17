'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PersonCell } from '@/components/ui/person-cell'
import type { PreferenceListDetail } from '@/lib/api/types'
import { useCycleStaff } from '@/lib/queries/cycle-staff'
import {
  useAddPreferenceListMember,
  usePreferenceListDetails,
  useRemovePreferenceListMember,
} from '@/lib/queries/preference-lists'

export function MembersDialog({
  open,
  onOpenChange,
  list,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  list: PreferenceListDetail
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Members</DialogTitle>
          <DialogDescription>
            Search by name or email, then add them to {list.name}.
          </DialogDescription>
        </DialogHeader>
        {open && <Members list={list} />}
      </DialogContent>
    </Dialog>
  )
}

function Members({ list }: { list: PreferenceListDetail }) {
  const { data: staff = [] } = useCycleStaff(list.cycle_id)
  const { data: teams = [] } = usePreferenceListDetails(list.cycle_id)
  const add = useAddPreferenceListMember()
  const remove = useRemovePreferenceListMember()
  const [query, setQuery] = useState('')

  const byNuid = new Map(staff.map((s) => [s.user_nuid, s]))
  const taken = new Set([
    ...list.members.map((m) => m.lead_nuid),
    ...teams.flatMap((t) => t.members.map((m) => m.lead_nuid)),
  ])
  const q = query.trim().toLowerCase()
  const matches = staff.filter(
    (s) =>
      !taken.has(s.user_nuid) &&
      (!q ||
        s.full_name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q))
  )

  return (
    <div className="flex flex-col gap-4">
      {list.members.length > 0 && (
        <ul className="divide-y divide-gray-100 border-b border-gray-100">
          {list.members.map((m) => {
            const person = byNuid.get(m.lead_nuid)
            return (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <PersonCell
                  name={person?.full_name ?? m.lead_nuid}
                  secondary={person?.email}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate({
                      listId: list.id,
                      memberId: m.id,
                      cycleId: list.cycle_id,
                    })
                  }
                >
                  Remove
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="relative">
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

      <div className="max-h-72 overflow-y-auto">
        {matches.length === 0 ? (
          <p className="text-text-faint py-6 text-center text-sm">
            {q ? 'No one matches.' : "Everyone's on a team."}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {matches.map((s) => (
              <li
                key={s.user_nuid}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <PersonCell name={s.full_name} secondary={s.email} />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={add.isPending}
                  onClick={() =>
                    add.mutate({
                      listId: list.id,
                      leadNuid: s.user_nuid,
                      cycleId: list.cycle_id,
                    })
                  }
                >
                  Add
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {add.error && (
        <p className="text-destructive text-sm">Couldn’t add them.</p>
      )}
    </div>
  )
}
