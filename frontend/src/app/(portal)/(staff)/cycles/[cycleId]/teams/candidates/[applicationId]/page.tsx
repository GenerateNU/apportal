import { ApplicationFullPage } from '@/app/(portal)/(staff)/cycles/[cycleId]/applicants/[id]/components/ApplicationFullPage'
import { requireChief } from '@/lib/auth/guards'

export const dynamic = 'force-dynamic'

export default async function CompareCandidateApplicantPage({
  params,
}: {
  params: Promise<{ cycleId: string; applicationId: string }>
}) {
  await requireChief()
  const { cycleId, applicationId } = await params
  const crumbs = [
    { label: 'Teams & preference lists', href: `/cycles/${cycleId}/teams` },
    {
      label: 'Compare candidates',
      href: `/cycles/${cycleId}/teams/candidates`,
    },
  ]
  return <ApplicationFullPage id={applicationId} crumbs={crumbs} />
}
