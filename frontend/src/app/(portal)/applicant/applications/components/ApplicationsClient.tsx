'use client'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { SegmentedTabs } from '@/components/ui/segmented-tabs'
import {
  ApplicantPage,
  applicationsHref,
  type ApplicationsTab,
} from './ApplicantPage'
import { MyApplicationsList } from './MyApplicationsList'

import { useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { HelpContact } from '@/components/HelpContact'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { SectionLabel } from '@/components/ui/section-label'
import { ApplicationRoleCard } from './ApplicationRoleCard'
import type {
  Application,
  ApplicationTemplate,
  Branch,
  Cycle,
  User,
} from '@/lib/api/types'
import { useApplications } from '@/lib/queries/applications'
import { useOpenApplicationTemplates } from '@/lib/queries/application-templates'
import { useBranches } from '@/lib/queries/branches'
import { useCycles, useCycleTemplateSummary } from '@/lib/queries/cycles'
import { useCurrentUser } from '@/lib/queries/users'

export function ApplicationsClient() {
  const { data: currentUser, isLoading } = useCurrentUser()

  if (isLoading) {
    return (
      <div className="text-text-muted flex items-center gap-2 px-4 py-10 text-sm sm:px-8">
        <Loader2 className="animate-spin" size={16} />
        Loading…
      </div>
    )
  }

  if (!currentUser) {
    return (
      <ApplicantPage>
        <PageHeader
          title="Applications"
          subtitle="Sign in to apply to open roles."
        />
      </ApplicantPage>
    )
  }

  return <Dashboard user={currentUser} />
}

type BranchGroup = {
  branchId: string
  branch: Branch | undefined
  cycles: { cycle: Cycle; templates: ApplicationTemplate[] }[]
}

function Dashboard({ user }: { user: User }) {
  const { data: cycles = [] } = useCycles({})
  const { data: branches = [] } = useBranches()
  const { data: applications = [] } = useApplications({
    user_nuid: user.nuid,
  })
  // Already filtered server-side to "cycle open AND template open".
  const { data: openTemplates = [] } = useOpenApplicationTemplates()

  const groups = useMemo(() => {
    const byBranch = new Map<string, BranchGroup>()
    for (const cycle of cycles) {
      const templates = openTemplates.filter((t) => t.cycle_id === cycle.id)
      if (templates.length === 0) continue
      const group = byBranch.get(cycle.branch_id) ?? {
        branchId: cycle.branch_id,
        branch: branches.find((b) => b.id === cycle.branch_id),
        cycles: [],
      }
      group.cycles.push({ cycle, templates })
      byBranch.set(cycle.branch_id, group)
    }
    return [...byBranch.values()].sort((a, b) =>
      (a.branch?.name ?? '').localeCompare(b.branch?.name ?? '')
    )
  }, [cycles, branches, openTemplates])

  const searchParams = useSearchParams()
  const router = useRouter()
  const requested = searchParams.get('tab')
  const hasCurrent = applications.some((a) =>
    cycles.some(
      (c) =>
        c.id === a.cycle_id && (c.status === 'open' || c.status === 'draft')
    )
  )
  const tab: ApplicationsTab =
    requested === 'mine' || requested === 'open'
      ? requested
      : hasCurrent
        ? 'mine'
        : 'open'

  return (
    <ApplicantPage>
      <div className="flex flex-col gap-8">
        <PageHeader
          back={<Breadcrumbs items={[{ label: 'Applications' }]} />}
          title="Applications"
          subtitle="Apply to open roles and keep track of the applications you've sent."
        />

        <SegmentedTabs<ApplicationsTab>
          className="self-start"
          tabs={[
            { id: 'open', label: 'Open roles' },
            {
              id: 'mine',
              label: 'My applications',
              count: applications.length,
            },
          ]}
          value={tab}
          onChange={(next) =>
            router.replace(applicationsHref(next), { scroll: false })
          }
        />

        {tab === 'mine' ? (
          <MyApplicationsList
            applications={applications}
            cycles={cycles}
            branches={branches}
          />
        ) : groups.length === 0 ? (
          <EmptyState
            title="No open roles right now"
            description="Check back when recruitment opens."
          />
        ) : (
          groups.map((group) => (
            <section key={group.branchId} className="flex flex-col gap-4">
              <h2 className="font-display text-ink text-lg font-bold tracking-tight uppercase">
                {group.branch?.name ?? '…'}
              </h2>
              {group.cycles.map(({ cycle, templates }, i) => (
                <CycleRoles
                  key={cycle.id}
                  cycle={cycle}
                  cycleColorIndex={i}
                  templates={templates}
                  applications={applications}
                />
              ))}
            </section>
          ))
        )}

        <HelpContact className="text-left" />
      </div>
    </ApplicantPage>
  )
}

function CycleRoles({
  cycle,
  cycleColorIndex,
  templates,
  applications,
}: {
  cycle: Cycle
  cycleColorIndex: number
  templates: ApplicationTemplate[]
  applications: Application[]
}) {
  const { data: summaries = [] } = useCycleTemplateSummary(cycle.id)
  const mine = applications.filter((a) => a.cycle_id === cycle.id)
  const byRole = new Map(mine.map((a) => [a.role_id, a]))

  return (
    <div className="flex flex-col gap-3">
      <SectionLabel as="h3">{cycle.name}</SectionLabel>
      <div className="grid gap-3 sm:grid-cols-2">
        {templates.map((template) => (
          <ApplicationRoleCard
            key={template.role_id}
            cycle={cycle}
            cycleColorIndex={cycleColorIndex}
            template={template}
            questionCount={
              summaries.find((s) => s.role_id === template.role_id)
                ?.question_count ?? 0
            }
            application={byRole.get(template.role_id)}
          />
        ))}
      </div>
    </div>
  )
}
