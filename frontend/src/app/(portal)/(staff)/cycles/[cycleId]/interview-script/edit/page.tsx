import { redirect } from 'next/navigation'

export default async function InterviewScriptEditPage({
  params,
}: {
  params: Promise<{ cycleId: string }>
}) {
  const { cycleId } = await params
  redirect(`/cycles/${cycleId}/interview-script`)
}
