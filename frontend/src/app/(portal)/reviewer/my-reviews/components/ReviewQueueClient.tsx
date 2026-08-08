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
import { useApplicantsByNuids } from '@/lib/queries/applicants'
import { useApplications } from '@/lib/queries/applications'
import { useCycles } from '@/lib/queries/cycles'
import { useCurrentUser } from '@/lib/queries/users'
import { useWrittenReviewsByApplicationIds } from '@/lib/queries/written-reviews'
import { ROLE_COLUMNS, ROLE_LABEL } from '@/lib/roles'

type Scope = 'mine' | 'all'

export function ReviewQueueClient() {
  const router = useRouter()
  const [scope, setScope] = useState<Scope>('mine')
  const { data: currentUser } = useCurrentUser()
  const { data: cycles = [] } = useCycles({})

  // Unlike the chief-only pipeline pages, this is a personal task queue, so
  // cycle and role default to "all" rather than forcing a single pick —
  // narrowing is optional, not required to see your work.
  const [cycleId, setCycleId] = useState<string>('all')
  const [activeRole, setActiveRole] = useState<Role | 'all'>('all')

  const { data: applications = [] } = useApplications({
    ...(scope === 'mine' && { assigned_to: currentUser?.nuid ?? '' }),
    ...(cycleId !== 'all' && { cycle_id: cycleId }),
    ...(activeRole !== 'all' && { role: activeRole }),
  })

  const nuids = useMemo(
    () => [...new Set(applications.map((a) => a.user_nuid))],
    [applications]
  )
  const applicantQueries = useApplicantsByNuids(nuids)
  const nameByNuid = useMemo(() => {
    const map: Record<string, string> = {}
    nuids.forEach((nuid, i) => {
      const data = applicantQueries[i]?.data
      if (data) map[nuid] = data.full_name
    })
    return map
  }, [nuids, applicantQueries])

  // Whether *my* review of each application has been submitted, so the
  // queue can show which ones are already done.
  const applicationIds = useMemo(
    () => applications.map((a) => a.id),
    [applications]
  )
  const reviewQueries = useWrittenReviewsByApplicationIds(applicationIds)
  const submittedAtByApplicationId = useMemo(() => {
    const map: Record<string, string | undefined> = {}
    applicationIds.forEach((id, i) => {
      const own = reviewQueries[i]?.data?.find(
        (r) => r.reviewer_nuid === currentUser?.nuid
      )
      map[id] = own?.submitted_at
    })
    return map
  }, [applicationIds, reviewQueries, currentUser?.nuid])

  return (
    <PageContainer>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-text-default text-2xl font-semibold">
            Review queue
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
          <div className="flex shrink-0 gap-1 rounded-lg border border-gray-100 bg-white p-1">
            <Button
              size="sm"
              variant={scope === 'mine' ? 'default' : 'ghost'}
              onClick={() => setScope('mine')}
            >
              Assigned to me
            </Button>
            <Button
              size="sm"
              variant={scope === 'all' ? 'default' : 'ghost'}
              onClick={() => setScope('all')}
            >
              All
            </Button>
          </div>
        </div>
      </div>

      {applications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
          <p className="text-text-default text-sm font-medium">
            {scope === 'mine'
              ? 'Nothing assigned to you yet'
              : 'Nothing to review yet'}
          </p>
          <p className="text-text-muted mt-1 text-sm">
            {scope === 'mine'
              ? 'A chief assigns applications for you to review.'
              : 'Submitted applications will show up here.'}
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
                    const submittedAt =
                      submittedAtByApplicationId[application.id]
                    return (
                      <div
                        key={application.id}
                        className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 bg-white p-4 transition-colors hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-text-default text-sm font-medium">
                            {nameByNuid[application.user_nuid] ??
                              application.user_nuid}
                          </span>
                          {submittedAt && (
                            <span className="bg-status-open/15 text-status-open inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium">
                              <Check size={12} />
                              Submitted{' '}
                              {new Date(submittedAt).toLocaleString(undefined, {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </span>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          onClick={() =>
                            router.push(
                              `/reviewer/my-reviews/${application.id}`
                            )
                          }
                        >
                          {submittedAt ? 'View' : 'Review'}
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
