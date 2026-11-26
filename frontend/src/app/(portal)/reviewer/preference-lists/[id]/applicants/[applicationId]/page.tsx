import { ApplicationFullPage } from '@/app/(portal)/reviewer/applications/[id]/components/ApplicationFullPage'
import { PHASE_LABEL } from '@/app/(portal)/reviewer/my-work/crumbs'
import { getPreferenceList } from '@/generated/preference-lists/preference-lists'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import { getServerIsChief } from '@/lib/auth/server-user'

export const dynamic = 'force-dynamic'

export default async function PreferenceListApplicantPage({
  params,
}: {
  params: Promise<{ id: string; applicationId: string }>
}) {
  const { id, applicationId } = await params
  const listHref = `/reviewer/preference-lists/${id}`
  const crumbs = (await getServerIsChief())
    ? [
        {
          label: 'Teams & preference lists',
          href: '/reviewer/preference-lists',
        },
        {
          label: await getPreferenceList(id, await getServerRequestOptions())
            .then((l) => l.name)
            .catch(() => 'Team'),
          href: listHref,
        },
      ]
    : [{ label: PHASE_LABEL.preference, href: listHref }]
  return <ApplicationFullPage id={applicationId} crumbs={crumbs} />
}
