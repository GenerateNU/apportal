'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useApplicantsByNuids } from '@/lib/queries/applicants'
import { useApplications } from '@/lib/queries/applications'
import { ROLE_COLUMNS, ROLE_LABEL } from '@/lib/roles'
import { REVIEWER_ACTOR } from '@/lib/stub-actor'

type Scope = 'mine' | 'all'

export function ReviewQueueClient() {
  const router = useRouter()
  const [scope, setScope] = useState<Scope>('mine')

  const { data: applications = [] } = useApplications(
    scope === 'mine' ? { assigned_to: REVIEWER_ACTOR.nuid } : {},
    { actor: REVIEWER_ACTOR }
  )

  const nuids = useMemo(
    () => [...new Set(applications.map((a) => a.user_nuid))],
    [applications]
  )
  const applicantQueries = useApplicantsByNuids(nuids, {
    actor: REVIEWER_ACTOR,
  })
  const nameByNuid = useMemo(() => {
    const map: Record<string, string> = {}
    nuids.forEach((nuid, i) => {
      const data = applicantQueries[i]?.data
      if (data) map[nuid] = data.full_name
    })
    return map
  }, [nuids, applicantQueries])

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-start justify-between gap-4">
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
                  {roleApps.map((application) => (
                    <div
                      key={application.id}
                      className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 bg-white p-4"
                    >
                      <span className="text-text-default text-sm font-medium">
                        {nameByNuid[application.user_nuid] ??
                          application.user_nuid}
                      </span>
                      <Button
                        variant="outline"
                        onClick={() =>
                          router.push(
                            `/reviewer/applications/${application.id}`
                          )
                        }
                      >
                        Review
                        <ArrowRight data-icon="inline-end" size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
