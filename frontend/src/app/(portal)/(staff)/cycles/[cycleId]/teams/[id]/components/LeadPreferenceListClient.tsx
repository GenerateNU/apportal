'use client'

import { useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingText } from '@/components/ui/loading-text'
import { PageHeader } from '@/components/ui/page-header'
import { PAGE_SHELL } from '@/components/ui/page-shell'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ApplicationDetail } from '@/app/(portal)/(staff)/cycles/[cycleId]/applicants/components/ApplicationDetail'
import { myWorkCrumbs } from '@/app/(portal)/(staff)/my-work/crumbs'
import { APIError } from '@/lib/api/client'
import { useApplication, useApplications } from '@/lib/queries/applications'
import { useInterviewsByApplicationIds } from '@/lib/queries/interviews'
import {
  usePreferenceList,
  usePreferenceListDeadlines,
  usePreferenceListDetails,
  usePreferenceLists,
} from '@/lib/queries/preference-lists'
import { useCycleRoles } from '@/lib/queries/roles'
import { useCurrentUser, useReviewerNames } from '@/lib/queries/users'
import { MEETING_DAY_LABEL } from '@/app/(portal)/(staff)/cycles/[cycleId]/applicants/components/meetingAvailability'
import { formatDate } from '@/lib/utils'
import { LeadTeamTab } from './LeadTeamTab'
import { CandidateExplorer } from '../../components/CandidateExplorer'
import { Fact, Facts } from '@/components/ui/facts'
import { Badge } from '@/components/ui/badge'
import { CalendarDays, Clock, Users } from 'lucide-react'
import { useCycleHref } from '@/hooks/useCycleHref'

export function LeadPreferenceListClient({
  id,
  embedded = false,
}: {
  id: string
  embedded?: boolean
}) {
  const toCycle = useCycleHref()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { data: list, isLoading, isError, error } = usePreferenceList(id)
  const cycleId = list?.cycle_id ?? ''
  const { data: currentUser } = useCurrentUser()
  const nameByNuid = useReviewerNames()
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

  const team = (
    memberNames.length > 0
      ? memberNames
      : list.members.map((m) => nameByNuid.get(m.lead_nuid) ?? 'Member')
  )
    .map((n) => (n === currentUser?.full_name ? 'you' : n.split(' ')[0]))
    .join(', ')
  const deadline = closesAtByRole[role]
  const subtitle = (
    <Facts>
      <span className="text-ink font-medium">{list.name}</span>
      {team && <Fact icon={Users}>{team}</Fact>}
      {list.meeting_day && (
        <Fact icon={CalendarDays}>
          Meets {MEETING_DAY_LABEL[list.meeting_day]}
        </Fact>
      )}
      {list.status === 'submitted' ? (
        <Badge size="sm" className="bg-emerald-50 text-emerald-700">
          Submitted {formatDate(list.submitted_at)}
        </Badge>
      ) : (
        deadline && <Fact icon={Clock}>Due {formatDate(deadline)}</Fact>
      )}
    </Facts>
  )

  return (
    <div className={PAGE_SHELL}>
      <div className="flex flex-col gap-3">
        <PageHeader
          back={
            embedded ? undefined : (
              <Breadcrumbs items={myWorkCrumbs('preference', list.name)} />
            )
          }
          title="Preference list"
          subtitle={subtitle}
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
            renderExplorer={(listAction) => (
              <CandidateExplorer
                cycleId={cycleId}
                roleId={role}
                listAction={listAction}
                fullPageHref={(applicationId) =>
                  toCycle(`/cycle/teams/${id}/applicants/${applicationId}`)
                }
              />
            )}
            groups={groups}
            ratings={ratings}
            closesAtByRole={closesAtByRole}
            currentUserNuid={currentUser?.nuid}
            initialTeamId={searchParams.get('team') ?? undefined}
            onOpenApplicant={setOpenApplicationId}
            roleTabs={
              roleIds.length > 1 && (
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger
                    aria-label="Position"
                    className="mb-3 h-9 w-60"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleIds.map((r) => (
                      <SelectItem key={r} value={r}>
                        {roleLabel(r)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            }
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
          fullPageHref={toCycle(
            `/cycle/teams/${id}/applicants/${openSummary.id}`
          )}
          onClose={() => setOpenApplicationId(null)}
        />
      )}
    </div>
  )
}
