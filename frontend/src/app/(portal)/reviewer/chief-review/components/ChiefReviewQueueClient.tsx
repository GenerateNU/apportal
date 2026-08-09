'use client'
import { PageContainer } from '@/components/PageContainer'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Role } from '@/lib/api/types'
import { useApplications } from '@/lib/queries/applications'
import { useChiefReviewsByApplications } from '@/lib/queries/chief-reviews'
import { pickDefaultCycleId, useCycles } from '@/lib/queries/cycles'
import { useCurrentUser } from '@/lib/queries/users'
import { ROLE_COLUMNS, ROLE_LABEL } from '@/lib/roles'

export function ChiefReviewQueueClient() {
  const router = useRouter()
  const { data: currentUser } = useCurrentUser()
  const { data: cycles = [] } = useCycles({})

  // Default cycle, same as the other chief-only pipeline pages. Shared with
  // the server prefetch in ../page.tsx, which scopes its application-list
  // prefetch to this same cycle.
  const [cycleId, setCycleId] = useState('')
  if (!cycleId && cycles.length > 0) {
    const defaultId = pickDefaultCycleId(cycles)
    if (defaultId) setCycleId(defaultId)
  }
  const [activeRole, setActiveRole] = useState<Role | 'all'>('all')

  const { data: applications = [] } = useApplications(
    cycleId
      ? { cycle_id: cycleId, ...(activeRole !== 'all' && { role: activeRole }) }
      : undefined
  )

  // Whether *my* review of each application counts as submitted (has a
  // comment — casting a vote alone doesn't count), so the queue can show
  // which ones are already done.
  const applicationIds = useMemo(
    () => applications.map((a) => a.id),
    [applications]
  )
  const chiefReviewQueries = useChiefReviewsByApplications(applicationIds)
  const submittedByApplicationId = useMemo(() => {
    const map: Record<string, boolean> = {}
    applicationIds.forEach((id, i) => {
      const own = chiefReviewQueries[i]?.data?.find(
        (r) => r.reviewer_nuid === currentUser?.nuid
      )
      map[id] = !!own?.notes?.trim()
    })
    return map
  }, [applicationIds, chiefReviewQueries, currentUser?.nuid])

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

      {applications.length === 0 ? (
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
                    return (
                      <div
                        key={application.id}
                        className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 bg-white p-4 transition-colors hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-text-default text-sm font-medium">
                            {application.full_name || application.user_nuid}
                          </span>
                          {submitted && (
                            <span className="bg-status-open/15 text-status-open inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium">
                              <Check size={12} />
                              Submitted
                            </span>
                          )}
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
