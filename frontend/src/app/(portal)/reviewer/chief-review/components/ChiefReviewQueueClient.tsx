'use client'
import { PageContainer } from '@/components/PageContainer'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useApplicantsByNuids } from '@/lib/queries/applicants'
import { useApplications } from '@/lib/queries/applications'
import { ROLE_COLUMNS, ROLE_LABEL } from '@/lib/roles'

export function ChiefReviewQueueClient() {
  const router = useRouter()

  const { data: applications = [] } = useApplications({})

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

  return (
    <PageContainer>
      <div>
        <h1 className="text-text-default text-2xl font-semibold">
          Chief review
        </h1>
        <p className="text-text-muted mt-1 text-sm">
          Review each applicant&apos;s lead scores and decide who advances to an
          interview.
        </p>
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
                            `/reviewer/chief-review/${application.id}`
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
    </PageContainer>
  )
}
