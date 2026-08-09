'use client'
import { PageContainer } from '@/components/PageContainer'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
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
import { useWrittenReviewsByApplicationIds } from '@/lib/queries/written-reviews'
import { ROLE_COLUMNS, ROLE_LABEL } from '@/lib/roles'
import type { ReviewState } from '../constants'
import { ReviewRow } from './ReviewRow'

type Scope = 'mine' | 'all'

// Same settle time as the applications table's search.
const SEARCH_DEBOUNCE_MS = 250

export function ReviewQueueClient() {
  const [scope, setScope] = useState<Scope>('mine')
  const { data: currentUser } = useCurrentUser()
  const { data: cycles = [] } = useCycles({})

  // Unlike the chief-only pipeline pages, this is a personal task queue, so
  // role stays "all" rather than forcing a single pick — narrowing is
  // optional, not required to see your work. Cycle defaults to the pinned
  // cycle (falling back to "all" if it isn't in the list) but can still be
  // switched back to "all cycles".
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

  const assignedTo = scope === 'mine' ? currentUser?.nuid : undefined

  const { data: applications = [] } = useApplications(
    {
      ...(assignedTo && { assigned_to: assignedTo }),
      ...(cycleId !== 'all' && { cycle_id: cycleId }),
      ...(activeRole !== 'all' && { role: activeRole }),
      ...(debouncedSearch && { search: debouncedSearch }),
    },
    undefined,
    // Hold the request until we know who "me" is. The backend skips empty
    // filter values, so firing early with no assigned_to reads as "every
    // application" and flashes the whole queue before narrowing.
    { enabled: scope === 'all' || !!assignedTo }
  )

  // How far *my* review of each application has got. A row with no
  // submitted_at is a saved draft.
  const applicationIds = useMemo(
    () => applications.map((a) => a.id),
    [applications]
  )
  const reviewQueries = useWrittenReviewsByApplicationIds(applicationIds)
  const reviewByApplicationId = useMemo(() => {
    const map: Record<string, { state: ReviewState; submittedAt?: string }> = {}
    applicationIds.forEach((id, i) => {
      const own = reviewQueries[i]?.data?.find(
        (r) => r.reviewer_nuid === currentUser?.nuid
      )
      map[id] = {
        state: own?.submitted_at ? 'submitted' : own ? 'draft' : 'none',
        submittedAt: own?.submitted_at,
      }
    })
    return map
  }, [applicationIds, reviewQueries, currentUser?.nuid])

  const reviewedCount = applicationIds.filter(
    (id) => reviewByApplicationId[id]?.state === 'submitted'
  ).length

  // Grouped by role; unfinished first, drafts ahead of untouched. It's a work
  // queue, so the top of it should be the work.
  const sections = useMemo(() => {
    const rank = { draft: 0, none: 1, submitted: 2 }
    return ROLE_COLUMNS.map((role) => ({
      role,
      applications: applications
        .filter((a) => a.role === role)
        .sort((a, b) => {
          const byState =
            rank[reviewByApplicationId[a.id]?.state ?? 'none'] -
            rank[reviewByApplicationId[b.id]?.state ?? 'none']
          if (byState !== 0) return byState
          return (a.full_name || a.user_nuid).localeCompare(
            b.full_name || b.user_nuid
          )
        }),
    })).filter((s) => s.applications.length > 0)
  }, [applications, reviewByApplicationId])

  // Reviewing 25–30 is sequential work, so the primary action is "pick up
  // where you left off" — the top of the list, given the sort above.
  const nextUnreviewed = sections
    .flatMap((s) => s.applications)
    .find((a) => reviewByApplicationId[a.id]?.state !== 'submitted')

  return (
    <PageContainer>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-text-default text-2xl font-semibold">
            Lead review
          </h1>
          <p className="text-text-muted mt-1 text-sm">
            {scope === 'mine'
              ? 'Applications assigned to you to write-review.'
              : 'All submitted applications.'}
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

          <div className="flex shrink-0 gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
            {(
              [
                { value: 'mine', label: 'Assigned to me' },
                { value: 'all', label: 'All' },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setScope(option.value)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-sm font-medium transition-colors',
                  scope === option.value
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {applications.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ProgressBar
              value={reviewedCount}
              total={applications.length}
              className="w-40"
            />
            <span className="text-text-muted text-xs">
              {reviewedCount} of {applications.length} reviewed
            </span>
          </div>
          {nextUnreviewed && (
            <Button asChild>
              <Link href={`/reviewer/my-reviews/${nextUnreviewed.id}`}>
                {reviewedCount === 0 ? 'Start reviewing' : 'Continue reviewing'}
                <ArrowRight data-icon="inline-end" size={14} />
              </Link>
            </Button>
          )}
        </div>
      )}

      {sections.length === 0 ? (
        <p className="text-text-faint px-1 text-sm">
          {debouncedSearch
            ? 'No applications match that search.'
            : scope === 'mine'
              ? 'Nothing assigned to you yet — a chief assigns applications for you to review.'
              : 'Nothing to review yet — submitted applications will show up here.'}
        </p>
      ) : (
        sections.map(({ role, applications: roleApplications }) => (
          <div key={role} className="flex flex-col gap-2">
            <h2 className="text-text-faint text-xs font-semibold tracking-wide uppercase">
              {ROLE_LABEL[role]} ({roleApplications.length})
            </h2>
            <div className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white">
              {roleApplications.map((application) => (
                <ReviewRow
                  key={application.id}
                  href={`/reviewer/my-reviews/${application.id}`}
                  name={application.full_name || application.user_nuid}
                  email={application.email || application.user_nuid}
                  stage={application.stage}
                  date={application.submitted_at}
                  state={reviewByApplicationId[application.id]?.state ?? 'none'}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </PageContainer>
  )
}
