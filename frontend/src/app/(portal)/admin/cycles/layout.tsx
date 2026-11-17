import { requireAdmin } from '@/lib/auth/guards'

export default async function AdminCyclesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAdmin()
  return children
}
