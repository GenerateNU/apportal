import { ApplicationFullPage } from '@/app/(portal)/reviewer/applications/[id]/components/ApplicationFullPage'
import { requireChief } from '@/lib/auth/guards'

export const dynamic = 'force-dynamic'

export default async function CompareCandidateApplicantPage({
  params,
}: {
  params: Promise<{ applicationId: string }>
}) {
  await requireChief()
  const { applicationId } = await params
  const crumbs = [
    { label: 'Teams & preference lists', href: '/reviewer/preference-lists' },
    {
      label: 'Compare candidates',
      href: '/reviewer/preference-lists/candidates',
    },
  ]
  return <ApplicationFullPage id={applicationId} crumbs={crumbs} />
}
