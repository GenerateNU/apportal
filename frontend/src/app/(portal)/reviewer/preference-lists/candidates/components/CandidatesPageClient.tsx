'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { pickDefaultCycleId } from '@/lib/queries/cycles'
import { useStaffCycles } from '@/lib/queries/cycle-staff'
import { useCycleRoles } from '@/lib/queries/roles'
import { CandidatesBoard } from '../../components/CandidatesBoard'

export function CandidatesPageClient() {
  const searchParams = useSearchParams()
  const { data: cycles = [] } = useStaffCycles()
  const cycleId = searchParams.get('cycle') || pickDefaultCycleId(cycles) || ''
  const { roleIds, roleLabel } = useCycleRoles(cycleId)
  const [role, setRole] = useState('')
  const activeRole = roleIds.includes(role) ? role : roleIds[0]

  return (
    <>
      <PageHeader
        back={
          <Breadcrumbs
            items={[
              {
                label: 'Teams & preference lists',
                href: `/reviewer/preference-lists${cycleId ? `?cycle=${cycleId}` : ''}`,
              },
              { label: 'Candidates' },
            ]}
          />
        }
        title="Candidates"
        subtitle="Everyone still in the running, grouped by interview rating."
        actions={
          roleIds.length > 1 && (
            <Select value={activeRole} onValueChange={setRole}>
              <SelectTrigger className="h-9 w-52" aria-label="Position">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleIds.map((r) => (
                  <SelectItem key={r} value={r}>
                    {roleLabel(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        }
      />
      {!cycleId ? (
        <EmptyState title="No cycles yet" />
      ) : (
        activeRole && <CandidatesBoard cycleId={cycleId} roleId={activeRole} />
      )}
    </>
  )
}
