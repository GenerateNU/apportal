import { PageContainer } from '@/components/PageContainer'
import { requireChief } from '@/lib/auth/guards'
import { PlacementsPageClient } from './PlacementsPageClient'

export const dynamic = 'force-dynamic'

export default async function PlacementsPage({
  params,
}: {
  params: Promise<{ cycleId: string; roleId: string }>
}) {
  const { cycleId, roleId } = await params
  await requireChief(cycleId)
  return (
    <PageContainer>
      <PlacementsPageClient cycleId={cycleId} roleId={roleId} />
    </PageContainer>
  )
}
