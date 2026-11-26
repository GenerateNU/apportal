import { notFound } from 'next/navigation'
import { requireStaff } from '@/lib/auth/guards'

export default async function CycleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ cycleId: string }>
}) {
  const [{ cycleId }, access] = await Promise.all([params, requireStaff()])
  if (!access.isAdmin && !access.staffCycleIds.includes(cycleId)) notFound()
  return children
}
