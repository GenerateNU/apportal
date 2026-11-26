import { ApplicationFullPage } from '@/app/(portal)/reviewer/applications/[id]/components/ApplicationFullPage'
import { PHASE_LABEL } from '@/app/(portal)/reviewer/my-work/crumbs'

export const dynamic = 'force-dynamic'

export default async function PreferenceListApplicantPage({
  params,
}: {
  params: Promise<{ id: string; applicationId: string }>
}) {
  const { id, applicationId } = await params
  const crumbs = [
    { label: PHASE_LABEL.preference, href: `/reviewer/preference-lists/${id}` },
  ]
  return <ApplicationFullPage id={applicationId} crumbs={crumbs} />
}
