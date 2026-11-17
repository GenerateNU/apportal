'use client'

import { useSearchParams } from 'next/navigation'
import { ApplicationsClient } from '@/app/(portal)/reviewer/applications/components/ApplicationsClient'
import { PageContainer } from '@/components/PageContainer'
import { PageSkeletonBody } from '@/components/ui/skeleton'
import { useRoles } from '@/lib/queries/roles'
import { useCycleCrumbs } from './CycleSubpage'

export function CycleApplicantsClient({
  branchId,
  cycleId,
}: {
  branchId: string
  cycleId: string
}) {
  const { back } = useCycleCrumbs(branchId, cycleId, 'Applicants')
  const roleId = useSearchParams().get('role')
  const { data: roles = [], isLoading } = useRoles()
  const role = roles.find((r) => r.id === roleId)?.name
  if (roleId && isLoading) {
    return (
      <PageContainer>
        {back}
        <PageSkeletonBody />
      </PageContainer>
    )
  }
  return (
    <ApplicationsClient
      key={role}
      back={back}
      roleFilter={role}
      fullPageHref={(id) =>
        `/admin/branches/${branchId}/cycles/${cycleId}/applicants/${id}`
      }
    />
  )
}
