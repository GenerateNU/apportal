'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Pencil, Users } from 'lucide-react'
import { PageContainer } from '@/components/PageContainer'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { SectionLabel } from '@/components/ui/section-label'
import { useCycleApplicationTemplates } from '@/lib/queries/application-templates'
import { useBranches } from '@/lib/queries/branches'
import { useCycles, useCycleTemplateSummary } from '@/lib/queries/cycles'
import { useRoles } from '@/lib/queries/roles'
import { ApplicationRow } from '../../../../../applications/components/ApplicationRow'
import { CycleDialog } from '../../../../../cycles/components/CycleDialog'
import { CycleRoles } from '../../../../../cycles/components/CycleRoles'
import { CYCLE_STATUS } from '../../../../../cycles/lib/cycle-meta'
import { ApplicationTypeBadge } from '../../../../components/ApplicationTypeBadge'
import { AdminReviewInfo } from '../../../../components/AdminReviewInfo'
import { CycleStaffButton } from '../../../../components/CycleStaff'
import { staffRolesFor } from '../../../../lib/cycle-staff'
import { applicationFormHref, branchCrumbs } from '../../../../lib/breadcrumbs'
import { cycleApplicationCards } from '../../../../lib/cycle-applications'

export function CycleDetailClient({
  branchId,
  cycleId,
}: {
  branchId: string
  cycleId: string
}) {
  const { data: branches = [] } = useBranches()
  const { data: cycles = [] } = useCycles({ branch_id: branchId })
  const { data: roles = [] } = useRoles()
  const { data: templates = [] } = useCycleApplicationTemplates(cycleId)
  const { data: summaries = [] } = useCycleTemplateSummary(cycleId)
  const [editing, setEditing] = useState(false)
  const [editKey, setEditKey] = useState(0)

  const branch = branches.find((b) => b.id === branchId)
  const cycle = cycles.find((c) => c.id === cycleId)
  const back = (
    <Breadcrumbs
      items={branchCrumbs({ branchId, branch, cycle, showCycle: true })}
    />
  )

  if (!cycle) {
    return (
      <PageContainer>
        {back}
        <EmptyState title="Cycle not found" />
      </PageContainer>
    )
  }

  const status = CYCLE_STATUS[cycle.status]
  const cards = cycleApplicationCards(cycle, templates, summaries)

  return (
    <PageContainer>
      <PageHeader
        back={back}
        title={cycle.name}
        subtitle={
          <span className="mt-2 inline-flex flex-wrap items-center gap-2">
            <ApplicationTypeBadge type={cycle.application_type} size="lg" />
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium ${status.badge}`}
            >
              <span className={`h-1.5 w-1.5 ${status.dot}`} aria-hidden />
              {status.label}
            </span>
          </span>
        }
        actions={
          <>
            {cycle.status !== 'closed' && (
              <Button variant="outline" asChild>
                <Link href={`/reviewer/applications?cycle=${cycle.id}`}>
                  <Users className="h-4 w-4" />
                  Browse applicants
                </Link>
              </Button>
            )}
            {staffRolesFor(cycle.application_type).length > 0 ? (
              <CycleStaffButton cycle={cycle} />
            ) : (
              <AdminReviewInfo />
            )}
            <Button
              onClick={() => {
                setEditKey((k) => k + 1)
                setEditing(true)
              }}
            >
              <Pencil className="h-4 w-4" />
              Edit cycle
            </Button>
          </>
        }
      />

      <CycleRoles
        cycleId={cycle.id}
        roles={roles.filter((r) => r.cycle_id === cycle.id)}
      />

      <section
        aria-labelledby="cycle-applications"
        className="flex flex-col gap-3"
      >
        <SectionLabel>
          <span id="cycle-applications">{`Applications · ${cards.length}`}</span>
        </SectionLabel>
        {cards.length === 0 ? (
          <EmptyState
            size="sm"
            title="No applications yet."
            description="Add a role and its draft application appears here."
          />
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => (
              <li key={card.role}>
                <ApplicationRow
                  template={card}
                  href={applicationFormHref(branchId, cycleId, card.role)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <CycleDialog
        key={editKey}
        open={editing}
        onOpenChange={setEditing}
        cycle={cycle}
      />
    </PageContainer>
  )
}
