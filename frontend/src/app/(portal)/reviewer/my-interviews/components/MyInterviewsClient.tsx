'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { PageContainer } from '@/components/PageContainer'
import { ProgressBar } from '@/components/ProgressBar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Role } from '@/lib/api/types'
import { useApplications } from '@/lib/queries/applications'
import { DEFAULT_CYCLE_ID, useCycles } from '@/lib/queries/cycles'
import { useCurrentUser } from '@/lib/queries/users'
import { useInterviewsByApplicationIdBatches } from '@/lib/queries/interviews'
import { ROLE_COLUMNS, ROLE_LABEL } from '@/lib/roles'
import type { ReviewState } from '../../my-reviews/constants'
import { InterviewRow } from './InterviewRow'

// Same settle time as the applications table's search.
const SEARCH_DEBOUNCE_MS = 250

export function MyInterviewsClient() {
  const { data: currentUser } = useCurrentUser()
  const { data: cycles = [] } = useCycles({})

  // A personal queue, so role stays "all" rather than forcing a pick. Cycle
  // defaults to the pinned cycle when it's in the list, but can be widened.
  const [cycleId, setCycleId] = useState<string>('all')
  const [cycleDefaulted, setCycleDefaulted] = useState(false)
  if (!cycleDefaulted && cycles.length > 0) {
    if (cycles.some((c) => c.id === DEFAULT_CYCLE_ID)) {
      setCycleId(DEFAULT_CYCLE_ID)
    }
    setCycleDefaulted(true)
  }
  const [activeRole, setActiveRole] = useState<Role | 'all'>('all')

  // Matched server-side, so it narrows the whole queue rather than the rows
  // already in hand.
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedSearch(search),
      SEARCH_DEBOUNCE_MS
    )
    return () => clearTimeout(timer)
  }, [search])

  const interviewerNuid = currentUser?.nuid

  const { data: applications = [] } = useApplications(
    {
      ...(interviewerNuid && { interviewer_nuid: interviewerNuid }),
      ...(cycleId !== 'all' && { cycle_id: cycleId }),
      ...(activeRole !== 'all' && { role: activeRole }),
      ...(debouncedSearch && { search: debouncedSearch }),
    },
    undefined,
    // Hold the request until we know who "me" is. The backend skips empty
    // filter values, so firing early reads as "every application" and flashes
    // the whole pipeline before narrowing.
    { enabled: !!interviewerNuid }
  )

  // How far my write-up for each interview has got, in one request for the
  // whole list rather than one per row.
  const applicationIds = useMemo(
    () => applications.map((a) => a.id),
    [applications]
  )
  const [interviewBatch] = useInterviewsByApplicationIdBatches(
    applicationIds.length > 0 ? [applicationIds] : []
  )
  const interviewByApplicationId = interviewBatch?.data

  const rows = useMemo(
    () =>
      applications.map((application) => {
        const interview = interviewByApplicationId?.[application.id]
        const state: ReviewState = interview?.submitted_at
          ? 'submitted'
          : interview
            ? 'draft'
            : 'none'
        return { application, interview, state }
      }),
    [applications, interviewByApplicationId]
  )

  const interviewedCount = rows.filter((r) => r.state === 'submitted').length

  // Grouped by role; unfinished first, then soonest scheduled — it's a work
  // queue, so the top of it should be the next interview to run.
  const sections = useMemo(() => {
    const rank = { draft: 0, none: 1, submitted: 2 }
    return ROLE_COLUMNS.map((role) => ({
      role,
      rows: rows
        .filter((r) => r.application.role === role)
        .sort((a, b) => {
          const byState = rank[a.state] - rank[b.state]
          if (byState !== 0) return byState
          const aAt = a.interview?.scheduled_at
          const bAt = b.interview?.scheduled_at
          if (aAt && bAt && aAt !== bAt) return aAt.localeCompare(bAt)
          if (aAt !== bAt) return aAt ? -1 : 1
          return (
            a.application.full_name || a.application.user_nuid
          ).localeCompare(b.application.full_name || b.application.user_nuid)
        }),
    })).filter((s) => s.rows.length > 0)
  }, [rows])

  return (
    <PageContainer>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-text-default text-2xl font-semibold">
            My interviews
          </h1>
          <p className="text-text-muted mt-1 text-sm">
            Applicants assigned to you to interview. Click a row to copy their
            email.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={activeRole}
            onValueChange={(val) => setActiveRole(val as Role | 'all')}
          >
            <SelectTrigger className="w-48" aria-label="Filter by role">
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
              <SelectItem value="all">All cycles</SelectItem>
              {cycles.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative w-full sm:w-60">
            <Search className="text-text-subtle absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search name or NUID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="focus:border-brand-blue text-text-default placeholder:text-text-subtle w-full rounded-md border border-gray-200 py-1.5 pr-3 pl-9 text-sm focus:outline-none"
            />
          </div>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="flex items-center gap-3">
          <ProgressBar
            value={interviewedCount}
            total={rows.length}
            className="w-40"
          />
          <span className="text-text-muted text-xs">
            {interviewedCount} of {rows.length} interviewed
          </span>
        </div>
      )}

      {sections.length === 0 ? (
        <p className="text-text-faint px-1 text-sm">
          {debouncedSearch
            ? 'No interviewees match that search.'
            : 'Nothing assigned to you yet — a chief assigns the applicants you interview.'}
        </p>
      ) : (
        sections.map(({ role, rows: roleRows }) => (
          <div key={role} className="flex flex-col gap-2">
            <h2 className="text-text-faint text-xs font-semibold tracking-wide uppercase">
              {ROLE_LABEL[role]} ({roleRows.length})
            </h2>
            <div className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white">
              {roleRows.map(({ application, interview, state }) => (
                <InterviewRow
                  key={application.id}
                  name={application.full_name || application.user_nuid}
                  email={application.email}
                  stage={application.stage}
                  scheduledAt={interview?.scheduled_at}
                  state={state}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </PageContainer>
  )
}
