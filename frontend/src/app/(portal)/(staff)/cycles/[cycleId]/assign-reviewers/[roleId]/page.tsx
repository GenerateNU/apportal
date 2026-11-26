import { redirect } from 'next/navigation'

export default async function ReviewBoardPage({
  params,
}: {
  params: Promise<{ cycleId: string; roleId: string }>
}) {
  const { cycleId, roleId } = await params
  redirect(`/cycles/${cycleId}/assign-reviewers?role=${roleId}`)
}
