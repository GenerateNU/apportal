import { redirect } from 'next/navigation'

export default async function ReviewBoardPage({
  params,
}: {
  params: Promise<{ roleId: string }>
}) {
  const { roleId } = await params
  redirect(`/reviewer/cycle/reviews?role=${roleId}`)
}
