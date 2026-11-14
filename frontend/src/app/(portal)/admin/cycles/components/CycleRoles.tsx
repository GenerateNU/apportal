'use client'

import { useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Role } from '@/lib/api/types'
import { ROLE_CHIP_CLASSES } from '@/lib/roles'
import { RoleDialog } from './RoleDialog'

// The roles a cycle recruits for, as chips; clicking one edits it.
export function CycleRoles({
  cycleId,
  roles,
}: {
  cycleId: string
  roles: Role[]
}) {
  // A role being edited, 'new' while creating, null while closed.
  const [editing, setEditing] = useState<Role | 'new' | null>(null)

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-text-faint mr-1 text-xs font-semibold tracking-wide uppercase">
        Roles
      </span>
      {roles.length === 0 && (
        <span className="text-text-muted text-sm">
          None yet — add one so this cycle can take applications.
        </span>
      )}
      {roles.map((role, i) => (
        <button
          key={role.id}
          type="button"
          onClick={() => setEditing(role)}
          aria-label={`Edit ${role.name}`}
          className={`group inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-80 ${ROLE_CHIP_CLASSES[i % ROLE_CHIP_CLASSES.length]}`}
        >
          {role.name}
          <Pencil
            size={10}
            className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          />
        </button>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs"
        onClick={() => setEditing('new')}
      >
        <Plus className="h-3 w-3" />
        Add role
      </Button>

      <RoleDialog
        // Remount per role so the name field starts from that role.
        key={editing === 'new' ? 'new' : (editing?.id ?? 'closed')}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        cycleId={cycleId}
        role={editing === 'new' || editing === null ? undefined : editing}
      />
    </div>
  )
}
