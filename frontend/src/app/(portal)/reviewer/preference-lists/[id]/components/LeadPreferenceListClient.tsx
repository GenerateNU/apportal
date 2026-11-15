'use client'

import { useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingText } from '@/components/ui/loading-text'
import { PageHeader } from '@/components/ui/page-header'
import { PAGE_SHELL } from '@/components/ui/page-shell'
import { SegmentedTabs } from '@/components/ui/segmented-tabs'
import { ApplicationDetail } from '@/app/(portal)/reviewer/applications/components/ApplicationDetail'
import { myWorkCrumbs } from '@/app/(portal)/reviewer/my-work/crumbs'
import { APIError } from '@/lib/api/client'
import { useApplication, useApplications } from '@/lib/queries/applications'
import { useCycle } from '@/lib/queries/cycles'
import { useInterviewsByApplicationIds } from '@/lib/queries/interviews'
import {
  usePreferenceList,
  usePreferenceListDeadlines,
  usePreferenceListDetails,
  usePreferenceLists,
} from '@/lib/queries/preference-lists'
import { useCycleRoles } from '@/lib/queries/roles'
import { useCurrentUser, useReviewerNames } from '@/lib/queries/users'
import { LeadTeamTab } from './LeadTeamTab'

export function LeadPreferenceListClient({ id }: { id: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { data: list, isLoading, isError, error } = usePreferenceList(id)
  const cycleId = list?.cycle_id ?? ''
  const { data: currentUser } = useCurrentUser()
  const nameByNuid = useReviewerNames()
  const { data: cycle } = useCycle(cycleId)
  const { roleIds, roleLabel } = useCycleRoles(cycleId)
  const { data: fetchedGroups = [] } = usePreferenceListDetails(cycleId)
  const groups = useMemo(
    () =>
      list
        ? fetchedGroups.map((g) => (g.id === list.id ? list : g))
        : fetchedGroups,
    [fetchedGroups, list]
  )
  const { data: summaries = [] } = usePreferenceLists(cycleId)
  const memberNames = summaries.find((l) => l.id === id)?.member_names ?? []
  const closesAtByRole = usePreferenceListDeadlines(cycleId, roleIds)

  const roleParam = searchParams.get('role') ?? ''
  const role = roleIds.includes(roleParam) ? roleParam : (roleIds[0] ?? '')

  function setRole(next: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('tab')
    params.set('role', next)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const { data: pool = [] } = useApplications(
    { cycle_id: cycleId, role_id: role, stages: 'selection' },
    undefined,
    { enabled: !!cycleId && !!role }
  )

  const applicationIds = useMemo(() => {
    const ids = new Set(pool.map((a) => a.id))
    for (const e of list?.entries ?? []) {
      if (e.role_id === role) ids.add(e.application_id)
    }
    for (const e of list?.personal_entries ?? []) {
      if (e.role_id === role) ids.add(e.application_id)
    }
    return [...ids].sort()
  }, [pool, list, role])
  const { data: interviews = {} } =
    useInterviewsByApplicationIds(applicationIds)
  const ratings = useMemo(
    () =>
      Object.fromEntries(
        applicationIds.map((appId) => [appId, interviews[appId]?.rating])
      ),
    [applicationIds, interviews]
  )

  const [openApplicationId, setOpenApplicationId] = useState<string | null>(
    null
  )
  const pooled = pool.find((a) => a.id === openApplicationId)
  const lazyApplication = useApplication(
    openApplicationId && !pooled ? openApplicationId : ''
  )
  const openSummary = pooled ?? lazyApplication.data

  if (isError) {
    const missing = error instanceof APIError && error.status === 404
    return (
      <div className={PAGE_SHELL}>
        <Breadcrumbs items={myWorkCrumbs('preference', 'Group')} />
        <EmptyState
          title={missing ? 'Preference list not found' : 'Something went wrong'}
          description={
            missing
              ? "This group doesn't exist, or you don't have access to it."
              : 'This preference list could not be loaded.'
          }
        />
      </div>
    )
  }

  if (isLoading || !list) {
    return (
      <div className={PAGE_SHELL}>
        <LoadingText />
      </div>
    )
  }

  const openPerson =
    pooled ??
    [
      ...list.entries,
      ...list.personal_entries,
      ...groups.flatMap((g) => g.entries ?? []),
    ].find((e) => e.application_id === openApplicationId)

  const subtitle = [cycle?.name, list.name].filter(Boolean).join(' · ')

  const roleCount = (r: string) =>
    list.entries.filter((e) => e.role_id === r).length

  return (
    <div className={PAGE_SHELL}>
      <div className="flex flex-col gap-3">
        <Breadcrumbs items={myWorkCrumbs('preference', list.name)} />
        <PageHeader
          title="Preference list"
          subtitle={subtitle}
          actions={
            roleIds.length > 1 && (
              <SegmentedTabs<string>
                value={role}
                onChange={setRole}
                tabs={roleIds.map((r) => ({
                  id: r,
                  label: roleLabel(r),
                  count: roleCount(r),
                }))}
              />
            )
          }
        />
      </div>

      {!role ? (
        <EmptyState
          title="No roles yet"
          description="This cycle has no applicant roles to rank."
        />
      ) : (
        <div className="flex flex-col gap-12">
          <LeadTeamTab
            key={role}
            list={list}
            role={role}
            roleIds={roleIds}
            pool={pool}
            groups={groups}
            ratings={ratings}
            closesAtByRole={closesAtByRole}
            currentUserNuid={currentUser?.nuid}
            currentUserName={currentUser?.full_name}
            memberNames={memberNames}
            initialTeamId={searchParams.get('team') ?? undefined}
            nameByNuid={nameByNuid}
            onOpenApplicant={setOpenApplicationId}
          />
        </div>
      )}

      {openApplicationId && openSummary && openPerson && (
        <ApplicationDetail
          applicant={{
            id: openSummary.id,
            nuid: openSummary.user_nuid,
            role: openSummary.role_id,
            cycleId: openSummary.cycle_id,
            stage: openSummary.stage,
            submittedAt: openSummary.submitted_at,
            fullName: openPerson.full_name,
            email: openPerson.email,
            returner: openPerson.returner,
          }}
          onClose={() => setOpenApplicationId(null)}
        />
      )}
    </div>
  )
}
