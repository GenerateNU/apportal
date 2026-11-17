'use client'

import { PageContainer } from '@/components/PageContainer'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingText } from '@/components/ui/loading-text'
import { PageHeader } from '@/components/ui/page-header'
import {
  AddStaffButton,
  CycleStaffPanel,
} from '../../../../components/CycleStaff'
import { staffHelpText } from '../../../../lib/cycle-staff'
import { useCycleCrumbs } from './CycleSubpage'

export function CycleTeamClient({
  branchId,
  cycleId,
}: {
  branchId: string
  cycleId: string
}) {
  const { cycle, isLoading, back } = useCycleCrumbs(
    branchId,
    cycleId,
    'Recruitment team'
  )
  return (
    <PageContainer>
      <PageHeader
        back={back}
        title="Recruitment team"
        subtitle={cycle ? staffHelpText(cycle.application_type) : undefined}
        actions={cycle && <AddStaffButton cycle={cycle} />}
      />
      {isLoading ? (
        <LoadingText />
      ) : cycle ? (
        <CycleStaffPanel cycle={cycle} />
      ) : (
        <EmptyState title="Cycle not found" />
      )}
    </PageContainer>
  )
}
