'use client'
import { PageContainer } from '@/components/PageContainer'

import { useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { ProgressBar } from '@/components/ProgressBar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ReviewerProgress, Role } from '@/lib/api/types'
import { pickDefaultCycleId, useCycles } from '@/lib/queries/cycles'
import { useReviewerProgress } from '@/lib/queries/reviewer-progress'
import { ROLE_COLUMNS, ROLE_LABEL } from '@/lib/roles'
import { REVIEW_STATE_BADGE } from '../../my-reviews/constants'
import { ReviewRow } from '../../my-reviews/components/ReviewRow'

export function ReviewProgressClient() {
  const { data: cycles = [] } = useCycles({})

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

      {roles.map((role) => (
        <RoleSection key={role} cycleId={cycleId} role={role} />
      ))}
    </PageContainer>
  )
}

function outstandingCount(lead: ReviewerProgress) {
  return lead.items.filter((i) => !i.submitted_at).length
}

function RoleSection({ cycleId, role }: { cycleId: string; role: Role }) {
  const { data: progress = [], isLoading } = useReviewerProgress(cycleId, role)

  // Only leads who actually carry applications, most behind first.
  const leads = useMemo(
    () =>
      progress
        .filter((p) => p.items.length > 0)
        .sort((a, b) => outstandingCount(b) - outstandingCount(a)),
    [progress]
  )

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-text-faint text-xs font-semibold tracking-wide uppercase">
        {ROLE_LABEL[role]}
      </h2>

      {isLoading ? (
        <p className="text-text-faint px-1 text-sm">Loading…</p>
      ) : leads.length === 0 ? (
        <p className="text-text-faint px-1 text-sm">
          No leads have applications assigned for this role yet.
        </p>
      ) : (
        leads.map((lead) => <LeadFolder key={lead.lead_nuid} lead={lead} />)
      )}
    </div>
  )
}

function LeadFolder({ lead }: { lead: ReviewerProgress }) {
  const [open, setOpen] = useState(false)

  const total = lead.items.length
  const submitted = total - outstandingCount(lead)
  const outstanding = total - submitted

  // Sorted the same way a lead's own queue is: outstanding work on top.
  const items = useMemo(
    () =>
      [...lead.items].sort((a, b) => {
        const byState = Number(!!a.submitted_at) - Number(!!b.submitted_at)
        return byState !== 0 ? byState : a.full_name.localeCompare(b.full_name)
      }),
    [lead.items]
  )

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
      >
        <ChevronRight
          size={16}
          className={`text-text-faint shrink-0 transition-transform ${
            open ? 'rotate-90' : ''
          }`}
        />
        <Avatar name={lead.full_name} size="sm" />
        <span className="text-text-default min-w-0 flex-1 truncate text-sm font-medium">
          {lead.full_name}
        </span>
        <ProgressBar
          value={submitted}
          total={total}
          className="hidden w-32 shrink-0 sm:block"
        />
        <span className="text-text-muted hidden w-24 shrink-0 text-xs sm:block">
          {submitted} of {total} done
        </span>
        <span
          className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${
            outstanding > 0
              ? REVIEW_STATE_BADGE.draft
              : REVIEW_STATE_BADGE.submitted
          }`}
        >
          {outstanding > 0 ? `${outstanding} outstanding` : 'All submitted'}
        </span>
      </button>

      {open && (
        <div className="divide-y divide-gray-100 border-t border-gray-200">
          {items.map((item) => (
            <ReviewRow
              key={item.application_id}
              href={`/reviewer/chief-review/${item.application_id}`}
              name={item.full_name}
              email={item.email}
              date={item.assigned_at}
              dateTooltip="Assigned to this lead"
              // This endpoint only reports submitted_at, so a saved draft is
              // indistinguishable from an untouched review here.
              state={item.submitted_at ? 'submitted' : 'none'}
              stateLabel={item.submitted_at ? 'Submitted' : 'Not submitted'}
            />
          ))}
        </div>
      )}
    </div>
  )
}
