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
import { useCycleRoles } from '@/lib/queries/roles'
import { CandidateExplorer } from '../../components/CandidateExplorer'
import { useMyTeamListAction } from '../../components/AddToMyList'

export function CandidatesPageClient() {
  const { cycleId } = useCycleScope('chief')
  const { roleIds, roleLabel } = useCycleRoles(cycleId)
  const [role, setRole] = useState('')
  const activeRole = roleIds.includes(role) ? role : roleIds[0]
  const listAction = useMyTeamListAction(cycleId, activeRole ?? '')

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
        activeRole && (
          <CandidateExplorer
            cycleId={cycleId}
            roleId={activeRole}
            listAction={listAction}
            fullPageHref={(applicationId) =>
              `/reviewer/preference-lists/candidates/${applicationId}`
            }
            filterable={false}
          />
        )
      )}
    </>
  )
}
