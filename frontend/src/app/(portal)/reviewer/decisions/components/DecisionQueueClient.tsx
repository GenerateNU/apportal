'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { PageContainer } from '@/components/PageContainer'
import { ProgressBar } from '@/components/ProgressBar'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { DecisionRow } from '@/lib/api/types'
import { defaultPipelineCycleId } from '@/lib/cycles'
import { useCycles } from '@/lib/queries/cycles'
import { useDecisions } from '@/lib/queries/decisions'
import { ROLE_COLUMNS, ROLE_LABEL } from '@/lib/roles'
import { ReviewRow } from '../../my-reviews/components/ReviewRow'
import { feedbackState, FEEDBACK_STATE_LABEL } from './constants'

// A lead's decision queue, laid out like their review and interview queues:
// everyone assigned to them, unfinished on top, one click into the applicant.
// The list is scoped server-side to applicants they interviewed.
export function DecisionQueueClient() {
  const { data: cycles = [] } = useCycles({})

  const [cycleId, setCycleId] = useState('')
  if (!cycleId && cycles.length > 0) {
    const defaultId = defaultPipelineCycleId(cycles)
    if (defaultId) setCycleId(defaultId)
  }

  const { data: rows = [], isLoading } = useDecisions(cycleId)

  // Grouped by role, unfinished first — it's a work queue, so the top of it
  // should be the work. Same ordering the detail page walks with next/back.
  const sections = useMemo(() => {
    const rank = { none: 0, draft: 1, submitted: 2 }
    return ROLE_COLUMNS.map((role) => ({
      role,
      rows: rows
        .filter((r) => r.application_role === role)
        .sort((a, b) => {
          const byState = rank[feedbackState(a)] - rank[feedbackState(b)]
          if (byState !== 0) return byState
          return a.full_name.localeCompare(b.full_name)
        }),
    })).filter((s) => s.rows.length > 0)
  }, [rows])

  const written = rows.filter((r) => feedbackState(r) === 'submitted').length
  const next = sections
    .flatMap((s) => s.rows)
    .find((r) => feedbackState(r) !== 'submitted')

  return (
    <PageContainer>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-text-default text-2xl font-semibold">
            Decision feedback
          </h1>
          <p className="text-text-muted mt-1 text-sm">
            Applicants you interviewed who are being rejected. Your two
            paragraphs go into the letter a chief sends them.
          </p>
        </div>
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
      </div>

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
        <p className="text-text-faint px-1 text-sm">Loading…</p>
      ) : sections.length === 0 ? (
        <p className="text-text-faint px-1 text-sm">
          Nothing here yet — applicants you interviewed show up once a chief
          decides not to move them forward.
        </p>
      ) : (
        sections.map(({ role, rows: roleRows }) => (
          <div key={role} className="flex flex-col gap-2">
            <h2 className="text-text-faint text-xs font-semibold tracking-wide uppercase">
              {ROLE_LABEL[role]} ({roleRows.length})
            </h2>
            <div className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white">
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
