import { CycleApplicantsClient } from '../components/CycleApplicantsClient'

export const dynamic = 'force-dynamic'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; cycleId: string }>
}) {
  const { id, cycleId } = await params
  return <CycleApplicantsClient branchId={id} cycleId={cycleId} />
}
