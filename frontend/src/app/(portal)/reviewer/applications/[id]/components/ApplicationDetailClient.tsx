'use client'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PageContainer } from '@/components/PageContainer'
import type { ApplicationStage, Role } from '@/lib/api/types'
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
  role: Role
  applicantNuid: string
  stage?: ApplicationStage
}) {
  return (
    <PageContainer className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <Link
          href="/reviewer/applications"
          className="text-text-muted hover:text-text-default inline-flex w-fit items-center gap-1 text-sm"
        >
          <ArrowLeft size={14} />
          Back to Applications
        </Link>

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
