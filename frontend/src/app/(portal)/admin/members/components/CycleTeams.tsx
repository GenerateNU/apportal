'use client'

import Link from 'next/link'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Cycle } from '@/lib/api/types'
import { useBranches } from '@/lib/queries/branches'
import { useCycles } from '@/lib/queries/cycles'
import { CycleStaffPanel } from '../../branches/components/CycleStaff'
import { Badge } from '@/components/ui/badge'

// Cycles that have a team to manage: chief cycles are run by admins, and archived ones are done.
export function useTeamCycles(picked: string) {
  const { data: cycles = [], isLoading } = useCycles({})
  const list = cycles.filter(
    (c) => c.status !== 'archived' && c.application_type !== 'chief'
  )
  return {
    list,
    cycle: list.find((c) => c.id === picked) ?? list[0],
    isLoading,
  }
}

export function CyclePicker({
  cycles,
  value,
  onChange,
}: {
  cycles: Cycle[]
  value?: string
  onChange: (id: string) => void
}) {
  const { data: branches = [] } = useBranches()
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-64" aria-label="Cycle">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {cycles.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            <span className="flex items-center gap-2">
              {c.name}
              {branchName(c.branch_id) && (
                <Badge size="sm">{branchName(c.branch_id)}</Badge>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function CycleTeams({ cycle }: { cycle?: Cycle }) {
  if (!cycle) {
    return (
      <EmptyState
        title="No cycles yet"
        description={
          <>
            Create one on the{' '}
            <Link
              href="/admin/branches"
              className="underline underline-offset-4"
            >
              Branches
            </Link>{' '}
            page.
          </>
        }
      />
    )
  }
  return <CycleStaffPanel cycle={cycle} />
}
