'use client'

import { useState } from 'react'
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
import { useCycleScope } from '@/hooks/useCycleScope'
import { useIsChief } from '@/lib/queries/cycle-staff'
import { useCycleRoles } from '@/lib/queries/roles'
import { CandidatesBoard } from '../../components/CandidatesBoard'
import { CompareTable } from '../../components/CompareTable'
import { SegmentedTabs } from '@/components/ui/segmented-tabs'

export function CandidatesPageClient() {
  const { cycleId } = useCycleScope(useIsChief() ? 'chief' : 'lead')
  const { roleIds, roleLabel } = useCycleRoles(cycleId)
  const [role, setRole] = useState('')
  const [view, setView] = useState<'board' | 'compare'>('board')
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
              { label: 'Compare candidates' },
            ]}
          />
        }
        title="Compare candidates"
        subtitle="Everyone still in the running, and which teams want them."
        actions={
          <>
            <SegmentedTabs<'board' | 'compare'>
              className="h-9 w-fit"
              tabs={[
                { id: 'board', label: 'By rating' },
                { id: 'compare', label: 'By team' },
              ]}
              value={view}
              onChange={setView}
            />
            {roleIds.length > 1 && (
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
            )}
          </>
        }
      />
      {!cycleId ? (
        <EmptyState title="No cycles yet" />
      ) : (
        activeRole &&
        (view === 'board' ? (
          <CandidatesBoard cycleId={cycleId} roleId={activeRole} />
        ) : (
          <CompareTable cycleId={cycleId} roleId={activeRole} />
        ))
      )}
    </>
  )
}
