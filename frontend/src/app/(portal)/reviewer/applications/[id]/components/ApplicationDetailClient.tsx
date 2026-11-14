'use client'
import { BackLink } from '@/components/ui/back-link'
import { PageContainer } from '@/components/PageContainer'
import type { ApplicationStage } from '@/lib/api/types'
import { ApplicantOverview } from '../../components/ApplicantOverview'

export function ApplicationDetailClient({
  applicationId,
  cycleId,
  role,
  applicantNuid,
  stage,
}: {
  applicationId: string
  cycleId: string
  role: string
  applicantNuid: string
  stage?: ApplicationStage
}) {
  return (
    <PageContainer className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <BackLink href="/reviewer/applications">Back to Applications</BackLink>

        <ApplicantOverview
          applicationId={applicationId}
          cycleId={cycleId}
          role={role}
          applicantNuid={applicantNuid}
          stage={stage}
        />
      </div>
    </PageContainer>
  )
}
