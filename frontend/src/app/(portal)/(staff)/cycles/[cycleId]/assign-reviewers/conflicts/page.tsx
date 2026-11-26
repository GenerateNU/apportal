import { redirect } from 'next/navigation'

export default async function ConflictsPage({
  params,
}: {
  params: Promise<{ cycleId: string }>
}) {
  const { cycleId } = await params
  redirect(`/cycles/${cycleId}/assign-reviewers`)
}
