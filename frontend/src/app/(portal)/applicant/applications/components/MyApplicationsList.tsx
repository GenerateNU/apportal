'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { SectionLabel } from '@/components/ui/section-label'
import { TABLE_FRAME } from '@/components/ui/table-styles'
import type { Application, Branch, Cycle } from '@/lib/api/types'
import { useRoleLookup } from '@/lib/queries/roles'
import { cn, formatDate } from '@/lib/utils'
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
        title="Active applications"
        empty="Nothing in progress right now."
        applications={current}
        cycles={cycles}
        branches={branches}
      />
      {past.length > 0 && (
        <ApplicationList
          title="Past applications"
          empty="No applications from earlier cycles."
          applications={past}
          cycles={cycles}
          branches={branches}
        />
      )}
    </div>
  )
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
        />
      )}
    </section>
  )
}

const ROW =
  'grid items-center gap-x-4 gap-y-1 px-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)_7rem_8rem_8rem]'

function ApplicationRows({
  applications,
  cycles,
  branches,
}: {
  applications: Application[]
  cycles: Cycle[]
  branches: Branch[]
}) {
  const { roleLabel } = useRoleLookup()

  return (
    <div className={TABLE_FRAME}>
      <div
        className={cn(
          ROW,
          'font-display text-text-subtle hidden border-b border-gray-100 py-2 text-[11px] tracking-wider uppercase lg:grid'
        )}
      >
        <span>Position</span>
        <span>Cycle</span>
        <span>Branch</span>
        <span>Last updated</span>
        <span>Status</span>
      </div>
      {applications.map((application) => {
        const cycle = cycles.find((c) => c.id === application.cycle_id)
        const branch = branches.find((b) => b.id === cycle?.branch_id)
        const isDraft = application.stage === 'draft'
        const status = APPLICANT_STATUS[application.stage]
        const href = isDraft
          ? `/applicant/applications/new?cycle=${application.cycle_id}&role=${application.role_id}&from=mine`
          : `/applicant/applications/${application.id}?from=mine`

        return (
          <Link
            key={application.id}
            href={href}
            className={cn(
              ROW,
              'group border-b border-gray-100 py-3.5 transition-colors last:border-b-0 hover:bg-gray-50'
            )}
          >
            <span className="text-ink truncate font-semibold">
              {roleLabel(application.role_id)}
            </span>
            <span className="text-text-muted truncate text-sm">
              {cycle?.name ?? '—'}
            </span>
            <span>
              {branch ? (
                <Badge size="sm">{branch.name}</Badge>
              ) : (
                <span className="text-text-subtle text-sm">—</span>
              )}
            </span>
            <span className="text-text-subtle text-sm">
              <span className="mr-1.5 lg:hidden">
                {application.submitted_at ? 'Submitted' : 'Edited'}
              </span>
              {formatDate(application.submitted_at ?? application.updated_at)}
            </span>
            <span>
              {isDraft ? (
                <Badge>In progress</Badge>
              ) : (
                <Badge className={status.className}>{status.label}</Badge>
              )}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
