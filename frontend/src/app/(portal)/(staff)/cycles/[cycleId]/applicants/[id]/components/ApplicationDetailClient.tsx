'use client'

import { type Crumb, Breadcrumbs } from '@/components/ui/breadcrumbs'
import { PAGE_TOP, PAGE_X } from '@/components/ui/page-shell'
import type { ApplicationStage } from '@/lib/api/types'
import { useApplicant } from '@/lib/queries/applicants'
import { cn } from '@/lib/utils'
import { ApplicantOverview } from '../../components/ApplicantOverview'
import { cycleHref } from '@/lib/cycle-paths'

export function ApplicationDetailClient({
  applicationId,
  cycleId,
  role,
  applicantNuid,
  stage,
  crumbs,
}: {
  crumbs?: Crumb[]
  applicationId: string
  cycleId: string
  role: string
  applicantNuid: string
  stage?: ApplicationStage
}) {
  const { data: applicant } = useApplicant(applicantNuid)
  return (
    <div
      className={cn(
        'flex min-h-0 w-full flex-1 flex-col gap-6 overflow-y-auto pb-12',
        PAGE_X,
        PAGE_TOP
      )}
    >
      <Breadcrumbs
        items={[
          ...(crumbs ?? [
            {
              label: 'Applicants',
              href: cycleHref(cycleId, '/cycle/applicants'),
            },
          ]),
          { label: applicant?.full_name ?? 'Applicant' },
        ]}
      />
      <ApplicantOverview
        applicationId={applicationId}
        cycleId={cycleId}
        role={role}
        applicantNuid={applicantNuid}
        stage={stage}
      />
    </div>
  )
}
