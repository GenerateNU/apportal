'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Cycle, Role } from '@/lib/api/types'
import { CycleDialog } from '../../cycles/components/CycleDialog'
import { CycleRoles } from '../../cycles/components/CycleRoles'
import { CYCLE_STATUS } from '../../cycles/lib/cycle-meta'
import { applicationTypeLabel } from './ApplicationTypeBadge'

export function CycleCard({ cycle, roles }: { cycle: Cycle; roles: Role[] }) {
  const [editing, setEditing] = useState(false)
  // Bumped on each open so the form starts from the cycle's current values.
  const [editKey, setEditKey] = useState(0)
  const status = CYCLE_STATUS[cycle.status]

  return (
    <article className="border-ink focus-within:outline-ink relative flex h-full flex-col border-2 bg-white transition-colors focus-within:outline-2 focus-within:outline-offset-2 hover:bg-gray-50">
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium ${status.badge}`}
          >
            <span className={`h-1.5 w-1.5 ${status.dot}`} aria-hidden />
            {status.label}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${cycle.name}`}
            onClick={() => {
              setEditKey((k) => k + 1)
              setEditing(true)
            }}
            className="relative z-10 -mt-1 -mr-1 shrink-0 rounded-none"
          >
            <Pencil size={16} aria-hidden />
          </Button>
        </div>
        <h3 className="font-display text-ink text-2xl leading-tight font-bold tracking-tight break-words uppercase">
          {/* Covers the tile so a click anywhere opens the cycle; the
              controls below sit above it. */}
          <Link
            href={`/admin/branches/${cycle.branch_id}/cycles/${cycle.id}`}
            className="after:absolute after:inset-0 focus-visible:outline-none"
          >
            {cycle.name}
          </Link>
        </h3>
        <div className="relative z-10">
          <CycleRoles cycleId={cycle.id} roles={roles} canAdd={false} />
        </div>
      </div>

      <div className="border-ink text-ink font-display flex h-12 items-center border-t-2 bg-white px-5 text-base font-bold tracking-wider uppercase">
        {applicationTypeLabel(cycle.application_type)}
      </div>

      <CycleDialog
        key={editKey}
        open={editing}
        onOpenChange={setEditing}
        cycle={cycle}
      />
    </article>
  )
}
