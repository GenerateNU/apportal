'use client'
import { PageContainer } from '@/components/PageContainer'

import { useMemo, useState } from 'react'
import { CheckCircle2, Circle } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ReviewerProgressItem } from '@/generated/model'
import type { Role } from '@/lib/api/types'
import { pickDefaultCycleId, useCycles } from '@/lib/queries/cycles'
import { useReviewerProgress } from '@/lib/queries/reviewer-progress'
import { useLeads } from '@/lib/queries/users'
import { ROLE_COLUMNS, ROLE_LABEL } from '@/lib/roles'

export function ReviewProgressClient() {
  const { data: cycles = [] } = useCycles({})
  const { data: leads = [] } = useLeads()

  // Scope the page to one cycle, same default as /reviewer/assignments.
  const [cycleId, setCycleId] = useState('')
  if (!cycleId && cycles.length > 0) {
    const defaultId = pickDefaultCycleId(cycles)
    if (defaultId) setCycleId(defaultId)
  }
  const [activeRole, setActiveRole] = useState<Role | 'all'>('all')

  const roles = activeRole === 'all' ? ROLE_COLUMNS : [activeRole]

  return (
    <PageContainer>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-text-default text-2xl font-semibold">
            Review progress
          </h1>
          <p className="text-text-muted mt-1 text-sm">
            See which leads still have written reviews outstanding.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={activeRole}
            onValueChange={(val) => setActiveRole(val as Role | 'all')}
          >
            <SelectTrigger className="w-56" aria-label="Filter by role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {ROLE_COLUMNS.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
      </div>

      {leads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
          <p className="text-text-default text-sm font-medium">
            No leads to show
          </p>
        </div>
      ) : (
        roles.map((role) => (
          <RoleSection key={role} cycleId={cycleId} role={role} />
        ))
      )}
    </PageContainer>
  )
}

function RoleSection({ cycleId, role }: { cycleId: string; role: Role }) {
  const { data: progress = [], isLoading } = useReviewerProgress(cycleId, role)

  const sorted = useMemo(
    () =>
      [...progress].sort((a, b) => {
        const outstanding = (p: (typeof progress)[number]) =>
          p.items.filter((i) => !i.submitted_at).length
        return outstanding(b) - outstanding(a)
      }),
    [progress]
  )

  return (
    <section>
      <h2 className="text-text-default mb-3 text-sm font-semibold">
        {ROLE_LABEL[role]}
      </h2>

      {isLoading ? (
        <p className="text-text-faint text-sm">Loading…</p>
      ) : sorted.length === 0 ? (
        <p className="text-text-faint rounded-xl border border-dashed border-gray-200 bg-white px-4 py-6 text-center text-sm">
          No leads found.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map((lead) => (
            <ReviewerCard key={lead.lead_nuid} lead={lead} />
          ))}
        </div>
      )}
    </section>
  )
}

function ReviewerCard({
  lead,
}: {
  lead: { lead_nuid: string; full_name: string; items: ReviewerProgressItem[] }
}) {
  const submitted = lead.items.filter((i) => i.submitted_at).length
  const total = lead.items.length

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-text-default text-sm font-medium">
          {lead.full_name}
        </span>
        <span className="text-text-muted text-xs">
          {submitted}/{total} submitted
        </span>
      </div>

      {total === 0 ? (
        <p className="text-text-faint mt-2 text-xs">
          No applications assigned.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-1.5">
          {lead.items.map((item) => (
            <div
              key={item.application_id}
              className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-1.5"
            >
              {item.submitted_at ? (
                <CheckCircle2
                  size={14}
                  className="flex-shrink-0 text-emerald-600"
                />
              ) : (
                <Circle size={14} className="text-text-faint flex-shrink-0" />
              )}
              <span className="text-text-default text-sm">
                {item.full_name}
              </span>
              <span className="text-text-faint ml-auto text-xs">
                {item.submitted_at ? 'Submitted' : 'Not submitted'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
