'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { SectionLabel } from '@/components/ui/section-label'
import { TABLE_FRAME, TABLE_ROW } from '@/components/ui/table-styles'
import type { Application, Branch, Cycle } from '@/lib/api/types'
import { useRoleLookup } from '@/lib/queries/roles'
import { formatDate } from '@/lib/utils'
import { APPLICANT_STATUS } from '../lib/status'

const CURRENT_STATUSES = new Set(['open', 'draft'])

export function MyApplicationsList({
  applications,
  cycles,
  branches,
}: {
  applications: Application[]
  cycles: Cycle[]
  branches: Branch[]
}) {
  const { current, past } = useMemo(() => {
    const byCycle = new Map(cycles.map((c) => [c.id, c]))
    const sorted = [...applications].sort((a, b) =>
      (b.submitted_at ?? b.updated_at).localeCompare(
        a.submitted_at ?? a.updated_at
      )
    )
    const isCurrent = (a: Application) =>
      CURRENT_STATUSES.has(byCycle.get(a.cycle_id)?.status ?? '')
    return {
      current: sorted.filter(isCurrent),
      past: sorted.filter((a) => !isCurrent(a)),
    }
  }, [applications, cycles])

  if (applications.length === 0) {
    return (
      <EmptyState
        title="No applications yet"
        description="Pick a role on the Open roles tab to start one."
      />
    )
  }

  return (
    <div className="flex flex-col gap-10">
      <ApplicationList
        title="Current"
        empty="Nothing in progress right now."
        applications={current}
        cycles={cycles}
        branches={branches}
      />
      {past.length > 0 && (
        <ApplicationList
          title="Past"
          empty="No applications from earlier cycles."
          applications={past}
          cycles={cycles}
          branches={branches}
        />
      )}
    </div>
  )
}

function cycleLabel(cycle: Cycle | undefined, branches: Branch[]) {
  const branch = branches.find((b) => b.id === cycle?.branch_id)
  return [branch?.name, cycle?.name].filter(Boolean).join(' · ')
}

function ApplicationList({
  title,
  empty,
  applications,
  cycles,
  branches,
}: {
  title: string
  empty: string
  applications: Application[]
  cycles: Cycle[]
  branches: Branch[]
}) {
  return (
    <section className="flex flex-col gap-3">
      <SectionLabel>{title}</SectionLabel>
      {applications.length === 0 ? (
        <EmptyState size="sm" title={empty} />
      ) : (
        <ApplicationRows
          applications={applications}
          cycles={cycles}
          branches={branches}
          showCycle
        />
      )}
    </section>
  )
}

function ApplicationRows({
  applications,
  cycles,
  branches,
  showCycle,
}: {
  applications: Application[]
  cycles: Cycle[]
  branches: Branch[]
  showCycle: boolean
}) {
  const { roleLabel } = useRoleLookup()

  return (
    <div className={TABLE_FRAME}>
      {applications.map((application) => {
        const cycle = cycles.find((c) => c.id === application.cycle_id)
        const isDraft = application.stage === 'draft'
        const status = APPLICANT_STATUS[application.stage]
        const href = isDraft
          ? `/applicant/applications/new?cycle=${application.cycle_id}&role=${application.role_id}&from=mine`
          : `/applicant/applications/${application.id}?from=mine`

        return (
          <Link
            key={application.id}
            href={href}
            className={`group flex flex-wrap items-center gap-x-6 gap-y-2 ${TABLE_ROW}`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-ink truncate font-semibold">
                {roleLabel(application.role_id)}
              </p>
              {showCycle && (
                <p className="text-text-muted truncate text-xs">
                  {cycleLabel(cycle, branches)}
                </p>
              )}
            </div>
            <span className="text-text-subtle hidden w-36 text-xs sm:block">
              {application.submitted_at
                ? `Submitted ${formatDate(application.submitted_at)}`
                : `Edited ${formatDate(application.updated_at)}`}
            </span>
            {isDraft ? (
              <Badge>In progress</Badge>
            ) : (
              <Badge className={status.className}>{status.label}</Badge>
            )}
            <span className="text-text-subtle group-hover:text-ink flex w-24 items-center justify-end gap-1 text-sm font-medium transition-colors">
              {isDraft ? 'Continue' : 'View'}
              <ArrowRight
                size={14}
                className="transition-transform group-hover:translate-x-1"
              />
            </span>
          </Link>
        )
      })}
    </div>
  )
}
