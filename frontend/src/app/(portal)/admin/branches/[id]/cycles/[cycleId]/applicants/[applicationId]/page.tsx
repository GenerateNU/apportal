import { ApplicationFullPage } from '@/app/(portal)/reviewer/applications/[id]/components/ApplicationFullPage'
import { getServerRequestOptions } from '@/lib/api/server-request-options'
import { fetchBranches } from '@/lib/queries/branches'
import { fetchCycles } from '@/lib/queries/cycles'
import { branchCrumbs, cycleHref } from '../../../../../lib/breadcrumbs'

export const dynamic = 'force-dynamic'

export default async function CycleApplicantPage({
  params,
}: {
  params: Promise<{ id: string; cycleId: string; applicationId: string }>
}) {
  const { id, cycleId, applicationId } = await params
  const opts = await getServerRequestOptions()
  const [branches, cycles] = await Promise.all([
    fetchBranches(opts),
    fetchCycles({ branch_id: id }, opts),
  ])
  const crumbs = [
    ...branchCrumbs({
      branchId: id,
      branch: branches.find((b) => b.id === id),
      cycleId,
      cycle: cycles.find((c) => c.id === cycleId),
      showCycle: true,
      page: 'Applicants',
    }).slice(0, -1),
    {
      label: 'Applicants',
      href: `${cycleHref(id, cycleId)}/applicants?cycle=${cycleId}`,
    },
  ]
  return <ApplicationFullPage id={applicationId} crumbs={crumbs} />
}
