'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { PageContainer } from '@/components/PageContainer'
import { ProgressBar } from '@/components/ProgressBar'
import { Button } from '@/components/ui/button'
import { TABLE_FRAME } from '@/components/ui/table-styles'
import { LoadingText } from '@/components/ui/loading-text'
import { PageHeader } from '@/components/ui/page-header'
import { SectionLabel } from '@/components/ui/section-label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { DecisionRow } from '@/lib/api/types'
import { defaultPipelineCycleId } from '@/lib/cycles'
import { useStaffCycles } from '@/lib/queries/cycle-staff'
import { useDecisions } from '@/lib/queries/decisions'
import { ReviewRow } from '../../my-reviews/components/ReviewRow'
import { feedbackState, FEEDBACK_STATE_LABEL } from './constants'
import { useCycleRoles } from '@/lib/queries/roles'

// A lead's decision queue, laid out like their review and interview queues:
// everyone assigned to them, unfinished on top, one click into the applicant.
// The list is scoped server-side to applicants they interviewed.
export function DecisionQueueClient() {
  const { data: cycles = [] } = useStaffCycles()

  const [cycleId, setCycleId] = useState('')
  if (!cycleId && cycles.length > 0) {
    const defaultId = defaultPipelineCycleId(cycles)
    if (defaultId) setCycleId(defaultId)
  }

  const { data: rows = [], isLoading } = useDecisions(cycleId)
  const { roleIds, roleLabel } = useCycleRoles(cycleId)

  // Grouped by role, unfinished first — it's a work queue, so the top of it
  // should be the work. Same ordering the detail page walks with next/back.
  const sections = useMemo(() => {
    const rank = { none: 0, draft: 1, submitted: 2 }
    return roleIds
      .map((role) => ({
        role,
        rows: rows
          .filter((r) => r.role_id === role)
          .sort((a, b) => {
            const byState = rank[feedbackState(a)] - rank[feedbackState(b)]
            if (byState !== 0) return byState
            return a.full_name.localeCompare(b.full_name)
          }),
      }))
      .filter((s) => s.rows.length > 0)
  }, [rows, roleIds])

  const written = rows.filter((r) => feedbackState(r) === 'submitted').length
  const next = sections
    .flatMap((s) => s.rows)
    .find((r) => feedbackState(r) !== 'submitted')

  return (
    <PageContainer>
      <PageHeader
        title="Decision feedback"
        subtitle="Applicants you interviewed who are being rejected. Your two paragraphs go into the letter a chief sends them."
        actions={
          <Select value={cycleId} onValueChange={setCycleId}>
            <SelectTrigger className="w-40" aria-label="Filter by cycle">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {cycles.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ProgressBar value={written} total={rows.length} className="w-40" />
            <span className="text-text-muted text-xs">
              {written} of {rows.length} written
            </span>
          </div>
          {next && (
            <Button asChild>
              <Link href={`/reviewer/decisions/${next.application_id}`}>
                {written === 0 ? 'Start writing' : 'Continue writing'}
                <ArrowRight data-icon="inline-end" size={14} />
              </Link>
            </Button>
          )}
        </div>
      )}

      {isLoading ? (
        <LoadingText className="px-1" />
      ) : sections.length === 0 ? (
        <p className="text-text-faint px-1 text-sm">
          Nothing here yet — applicants you interviewed show up once a chief
          decides not to move them forward.
        </p>
      ) : (
        sections.map(({ role, rows: roleRows }) => (
          <div key={role} className="flex flex-col gap-2">
            <SectionLabel>
              {roleLabel(role)} ({roleRows.length})
            </SectionLabel>
            <div className={TABLE_FRAME}>
              {roleRows.map((row) => (
                <QueueRow key={row.application_id} row={row} />
              ))}
            </div>
          </div>
        ))
      )}
    </PageContainer>
  )
}

function QueueRow({ row }: { row: DecisionRow }) {
  const state = feedbackState(row)
  return (
    <ReviewRow
      href={`/reviewer/decisions/${row.application_id}`}
      name={row.full_name}
      email={row.email}
      state={state}
      stateLabel={FEEDBACK_STATE_LABEL[state]}
      stateTooltip={
        row.sent_at ? 'Sent — this decision has gone out' : undefined
      }
    />
  )
}
