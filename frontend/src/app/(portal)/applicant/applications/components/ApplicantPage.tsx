'use client'

import { useSearchParams } from 'next/navigation'
import { useBranches } from '@/lib/queries/branches'
import { useCycle } from '@/lib/queries/cycles'

export const APPLY_HREF = '/applicant/applications'
export type ApplicationsTab = 'open' | 'mine'

export function applicationsHref(tab: ApplicationsTab) {
  return `${APPLY_HREF}?tab=${tab}`
}

// The Applications tab an application page was opened from, so its breadcrumb
// and back navigation return to that tab.
export function useOriginCrumb() {
  const tab = useSearchParams().get('from') === 'mine' ? 'mine' : 'open'
  return { label: 'Applications', href: applicationsHref(tab) }
}

export function ApplicantPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col px-5 py-8 sm:px-10 sm:py-12 lg:px-16 xl:px-24">
      {children}
    </div>
  )
}

export function useCycleCrumb(cycleId: string, cycleName: string) {
  const { data: cycle } = useCycle(cycleId)
  const { data: branches = [] } = useBranches()
  const branch = branches.find((b) => b.id === cycle?.branch_id)
  return branch ? `${branch.name} · ${cycleName}` : cycleName
}
