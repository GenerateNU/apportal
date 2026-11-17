'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Pencil, Plus, Users } from 'lucide-react'
import { PageContainer } from '@/components/PageContainer'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Subheading } from '@/components/ui/subheading'
import { useBranches } from '@/lib/queries/branches'
import { useCycles, useCycleTemplateSummary } from '@/lib/queries/cycles'
import { ApplicationRow } from '../../../../../applications/components/ApplicationRow'
import { cycleApplicationCards } from '../../../../lib/cycle-applications'
import { useCycleApplicationTemplates } from '@/lib/queries/application-templates'
import { useWorkflow } from '@/lib/queries/workflow'
import { CycleDialog } from '../../../../../cycles/components/CycleDialog'
import { RoleDialog } from '../../../../../cycles/components/RoleDialog'
import type { Role } from '@/lib/api/types'
import { CYCLE_STATUS } from '../../../../../cycles/lib/cycle-meta'
import { AdminReviewInfo } from '../../../../components/AdminReviewInfo'
import { applicationTypeLabel } from '../../../../components/ApplicationTypeBadge'
import { staffRolesFor } from '../../../../lib/cycle-staff'
import {
  applicationFormHref,
  branchCrumbs,
  cycleHref,
} from '../../../../lib/breadcrumbs'
import { useCycleStaff } from '@/lib/queries/cycle-staff'

export function CycleDetailClient({
  branchId,
  cycleId,
}: {
  branchId: string
  cycleId: string
}) {
  const { data: branches = [] } = useBranches()
  const { data: cycles = [] } = useCycles({ branch_id: branchId })
  const { data: templates = [] } = useCycleApplicationTemplates(cycleId)
  const { data: workflow } = useWorkflow(cycleId)
  const { data: summaries = [] } = useCycleTemplateSummary(cycleId)
  const { data: staff = [] } = useCycleStaff(cycleId)
  const [editing, setEditing] = useState(false)
  const [roleEditing, setRoleEditing] = useState<Role | 'new' | null>(null)
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
  const applicationState = new Map(
    (workflow?.steps ?? [])
      .find((st) => st.step === 'applications')
      ?.openings?.map((o) => [o.role_id, o.state]) ?? []
  )
  const cards = cycleApplicationCards(cycle, templates, summaries).map(
    (card) => ({
      ...card,
      status: applicationState.get(card.role) ?? card.status ?? 'draft',
    })
  )

  return (
    <PageContainer>
      <PageHeader
        back={back}
        title={cycle.name}
        subtitle={
          <span className="text-text-muted mt-1 inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span>{applicationTypeLabel(cycle.application_type)}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className={`h-1.5 w-1.5 rounded-full ${status.dot}`}
                aria-hidden
              />
              {status.label}
            </span>
          </span>
        }
        actions={
          <>
            {cycle.status !== 'closed' && (
              <Button variant="outline" asChild>
                <Link
                  href={`${cycleHref(branchId, cycle.id)}/applicants?cycle=${cycle.id}`}
                >
                  <Users className="h-4 w-4" />
                  Browse applicants
                </Link>
              </Button>
            )}
            {staffRolesFor(cycle.application_type).length > 0 ? (
              <Button variant="outline" asChild>
                <Link href={`${cycleHref(branchId, cycle.id)}/team`}>
                  <Users className="h-4 w-4" />
                  {`Recruitment team · ${staff.length}`}
                </Link>
              </Button>
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

      <section
        aria-labelledby="cycle-applications"
        className="flex flex-col gap-3"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Subheading
            id="cycle-applications"
            title={`Application forms · ${cards.length}`}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRoleEditing('new')}
          >
            <Plus className="h-3.5 w-3.5" />
            Add position
          </Button>
        </div>
        {cards.length === 0 ? (
          <EmptyState
            size="sm"
            title="No application forms yet."
            description="Add a position and its form appears here."
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

      <RoleDialog
        key={roleEditing === 'new' ? 'new' : (roleEditing?.id ?? 'closed')}
        open={roleEditing !== null}
        onOpenChange={(open) => !open && setRoleEditing(null)}
        cycleId={cycle.id}
        role={
          roleEditing === 'new' || roleEditing === null
            ? undefined
            : roleEditing
        }
      />

      <CycleDialog
        key={editKey}
        open={editing}
        onOpenChange={setEditing}
        cycle={cycle}
      />
    </PageContainer>
  )
}
