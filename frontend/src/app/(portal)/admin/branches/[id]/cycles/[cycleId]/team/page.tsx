import { CycleTeamClient } from '../components/CycleTeamClient'

export const dynamic = 'force-dynamic'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; cycleId: string }>
}) {
  const { id, cycleId } = await params
  return <CycleTeamClient branchId={id} cycleId={cycleId} />
}
