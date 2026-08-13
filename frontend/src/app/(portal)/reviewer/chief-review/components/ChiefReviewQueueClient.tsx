'use client'
import { PageContainer } from '@/components/PageContainer'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ApplicationStage, Role } from '@/lib/api/types'
import { useApplications } from '@/lib/queries/applications'
import { useChiefReviewsByApplicationIdBatch } from '@/lib/queries/chief-reviews'
import { pickDefaultCycleId, useCycles } from '@/lib/queries/cycles'
import { useReviewerProgress } from '@/lib/queries/reviewer-progress'
import { useChiefReviewers, useCurrentUser } from '@/lib/queries/users'
import { FILTER_STAGES } from '@/app/(portal)/reviewer/applications/components/constants'
import { ROLE_COLUMNS, ROLE_LABEL } from '@/lib/roles'

// Persisted across visits (not just in-session) so leaving the queue to
// review an applicant and coming back doesn't reset the filters.
const FILTERS_STORAGE_KEY = 'chief-review-queue-filters'

type StoredFilters = {
  cycleId?: string
  role?: Role | 'all'
  stage?: ApplicationStage | 'all'
}

function readStoredFilters(): StoredFilters {
  try {
    return JSON.parse(localStorage.getItem(FILTERS_STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function writeStoredFilters(patch: StoredFilters) {
  localStorage.setItem(
    FILTERS_STORAGE_KEY,
    JSON.stringify({ ...readStoredFilters(), ...patch })
  )
}

export function ChiefReviewQueueClient() {
  const router = useRouter()
  const { data: currentUser } = useCurrentUser()
  const { data: cycles = [] } = useCycles({})
  const { data: chiefs = [], isLoading: chiefsLoading } = useChiefReviewers()

  // Default cycle, same as the other chief-only pipeline pages. Shared with
  // the server prefetch in ../page.tsx, which scopes its application-list
  // prefetch to this same cycle.
  const [cycleId, setCycleIdState] = useState('')
  const [activeRole, setActiveRoleState] = useState<Role | 'all'>('all')
  // Chief review is only actionable once a lead's finished with it, so the
  // queue starts scoped to that stage instead of every stage an application
  // ever passes through.
  const [activeStage, setActiveStageState] = useState<ApplicationStage | 'all'>(
    'chief_review'
  )

  // Restored once on mount — done in an effect (rather than a useState
  // initializer) so the server-rendered markup and the first client render
  // match before localStorage is consulted.
  useEffect(() => {
    const stored = readStoredFilters()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored.cycleId) setCycleIdState(stored.cycleId)
    if (stored.role) setActiveRoleState(stored.role)
    if (stored.stage) setActiveStageState(stored.stage)
  }, [])

  if (!cycleId && cycles.length > 0) {
    const defaultId = pickDefaultCycleId(cycles)
    if (defaultId) setCycleIdState(defaultId)
  }

  function setCycleId(id: string) {
    setCycleIdState(id)
    writeStoredFilters({ cycleId: id })
  }
  function setActiveRole(role: Role | 'all') {
    setActiveRoleState(role)
    writeStoredFilters({ role })
  }
  function setActiveStage(stage: ApplicationStage | 'all') {
    setActiveStageState(stage)
    writeStoredFilters({ stage })
  }

  const { data: applications = [], isLoading: applicationsLoading } =
    useApplications(
      cycleId
        ? {
            cycle_id: cycleId,
            ...(activeRole !== 'all' && { role: activeRole }),
            ...(activeStage !== 'all' && { stage: activeStage }),
          }
        : undefined
    )

  const applicationIds = useMemo(
    () => applications.map((a) => a.id),
    [applications]
  )

  // All chief reviews for the queue in one request rather than one per
  // application, used both for "have I reviewed this" and the vote count.
  const { data: chiefReviewsByApplicationId = {}, isLoading: reviewsLoading } =
    useChiefReviewsByApplicationIdBatch(applicationIds)

  // A review is a cast vote — a comment is optional and doesn't by itself
  // count as having reviewed.
  const submittedByApplicationId = useMemo(() => {
    const map: Record<string, boolean> = {}
    for (const id of applicationIds) {
      const own = chiefReviewsByApplicationId[id]?.find(
        (r) => r.reviewer_nuid === currentUser?.nuid
      )
      map[id] = !!own?.vote
    }
    return map
  }, [applicationIds, chiefReviewsByApplicationId, currentUser?.nuid])

  const chiefVoteCountByApplicationId = useMemo(() => {
    const map: Record<string, number> = {}
    for (const id of applicationIds) {
      map[id] = (chiefReviewsByApplicationId[id] ?? []).filter(
        (r) => !!r.vote
      ).length
    }
    return map
  }, [applicationIds, chiefReviewsByApplicationId])

  // How many of the leads assigned to each application have submitted their
  // written review, so the queue can show "x/x reviews completed". Fetched
  // per role — a fixed, small list, so this is always ROLE_COLUMNS.length
  // requests rather than one per application. ROLE_COLUMNS is a module-level
  // constant, so this calls the hook the same number of times every render.
  const reviewerProgressQueries = ROLE_COLUMNS.map((role) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useReviewerProgress(cycleId, role)
  )
  const activeReviewerProgressQueries = reviewerProgressQueries.filter(
    (_, i) => activeRole === 'all' || ROLE_COLUMNS[i] === activeRole
  )
  const leadReviewProgressByApplicationId: Record<
    string,
    { completed: number; total: number }
  > = {}
  for (const query of activeReviewerProgressQueries) {
    for (const lead of query.data ?? []) {
      for (const item of lead.items) {
        const entry = leadReviewProgressByApplicationId[
          item.application_id
        ] ?? { completed: 0, total: 0 }
        entry.total += 1
        if (item.submitted_at) entry.completed += 1
        leadReviewProgressByApplicationId[item.application_id] = entry
      }
    }
  }

  const isLoading =
    applicationsLoading ||
    reviewsLoading ||
    chiefsLoading ||
    activeReviewerProgressQueries.some((q) => q.isLoading)

  return (
    <PageContainer>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-text-default text-2xl font-semibold">
            Chief review
          </h1>
          <p className="text-text-muted mt-1 text-sm">
            Review each applicant&apos;s lead scores and decide who advances to
            an interview.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={activeStage}
            onValueChange={(val) =>
              setActiveStage(val as ApplicationStage | 'all')
            }
          >
            <SelectTrigger className="w-56" aria-label="Filter by stage">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILTER_STAGES.map(({ label, value }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

      {isLoading ? (
        <div className="text-text-muted flex items-center gap-2 px-2 py-10 text-sm">
          <Loader2 className="animate-spin" size={16} />
          Loading…
        </div>
      ) : applications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
          <p className="text-text-default text-sm font-medium">
            Nothing to review yet
          </p>
          <p className="text-text-muted mt-1 text-sm">
            Submitted applications will show up here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {ROLE_COLUMNS.map((role) => {
            const roleApps = applications.filter((a) => a.role === role)
            if (roleApps.length === 0) return null
            return (
              <section key={role}>
                <h2 className="text-text-default mb-3 text-sm font-semibold">
                  {ROLE_LABEL[role]}{' '}
                  <span className="text-text-faint font-normal">
                    ({roleApps.length})
                  </span>
                </h2>
                <div className="flex flex-col gap-3">
                  {roleApps.map((application) => {
                    const submitted = submittedByApplicationId[application.id]
                    const leadProgress =
                      leadReviewProgressByApplicationId[application.id]
                    const chiefVoteCount =
                      chiefVoteCountByApplicationId[application.id] ?? 0
                    return (
                      <div
                        key={application.id}
                        className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 bg-white p-4 transition-colors hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-text-default text-sm font-medium">
                            {application.full_name || application.user_nuid}
                          </span>
                          {leadProgress && leadProgress.total > 0 && (
                            <span
                              className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                                leadProgress.completed === leadProgress.total
                                  ? 'bg-status-open/15 text-status-open'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {leadProgress.completed}/{leadProgress.total}{' '}
                              reviews completed
                            </span>
                          )}
                          {submitted && (
                            <span className="bg-status-open/15 text-status-open inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium">
                              <Check size={12} />
                              Submitted
                            </span>
                          )}
                          <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                            {chiefVoteCount}/{chiefs.length} chiefs reviewed
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() =>
                            router.push(
                              `/reviewer/chief-review/${application.id}`
                            )
                          }
                        >
                          {submitted ? 'View' : 'Review'}
                          <ArrowRight data-icon="inline-end" size={14} />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </PageContainer>
  )
}
