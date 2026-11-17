import { requireSignedIn } from '@/lib/auth/guards'

export default async function ApplicantLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireSignedIn()
  return children
}
