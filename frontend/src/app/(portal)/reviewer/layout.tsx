import { requireStaff } from '@/lib/auth/guards'

export default async function ReviewerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireStaff()
  return children
}
