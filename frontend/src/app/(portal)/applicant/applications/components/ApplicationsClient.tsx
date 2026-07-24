'use client'

import { useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { HelpContact } from '@/components/HelpContact'
import { ApplicationRoleCard } from './ApplicationRoleCard'
import type {
  Application,
  ApplicationTemplate,
  Cycle,
  User,
} from '@/lib/api/types'
import { useApplications } from '@/lib/queries/applications'
import { useOpenApplicationTemplates } from '@/lib/queries/application-templates'
import { useCycles, useCycleTemplateSummary } from '@/lib/queries/cycles'
import { useCurrentUser } from '@/lib/queries/users'
import { ROLE_CHIP_CLASS, ROLE_LABEL } from '@/lib/roles'
import { APPLICANT_STATUS } from '../lib/status'

export function ApplicationsClient() {
  const { data: currentUser, isLoading } = useCurrentUser()

  if (isLoading) {
    return (
      <div className="text-text-muted flex items-center gap-2 px-8 py-10 text-sm">
        <Loader2 className="animate-spin" size={16} />
        Loading…
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="mx-auto w-full max-w-3xl px-8 py-10">
        <h1 className="text-text-default text-2xl font-semibold">
          My Applications
        </h1>
        <p className="text-text-muted mt-2 text-sm">
          Sign in to apply to open roles.
        </p>
      </div>
    )
  }

  return <Dashboard user={currentUser} />
}

function Dashboard({ user }: { user: User }) {
  const { data: cycles = [] } = useCycles({})
  const { data: applications = [] } = useApplications({
    user_nuid: user.nuid,
  })

  // Which roles are actually visible ("cycle open AND its own template open")
  // is decided entirely server-side by list-open-application-templates — this
  // just groups the already-filtered rows by cycle for rendering.
  // opens_at/closes_at are currently just metadata — nothing auto-opens/closes.
  // TODO: decide how to honor opens_at/closes_at, e.g. by folding an
  // "effective open" window check into that same backend query.
  const { data: openTemplates = [] } = useOpenApplicationTemplates()

  const openTemplatesByCycle = useMemo(() => {
    const map: Record<string, ApplicationTemplate[]> = {}
    openTemplates.forEach((template) => {
      const templates = (map[template.cycle_id] ??= [])
      templates.push(template)
    })
    return map
  }, [openTemplates])

  const visibleCycles = useMemo(
    () => cycles.filter((cycle) => openTemplatesByCycle[cycle.id]?.length),
    [cycles, openTemplatesByCycle]
  )

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
      <header className="mb-8">
        <h1 className="text-text-default text-2xl font-semibold">
          My Applications
        </h1>
        <p className="text-text-muted mt-1 text-sm">
          Apply to open roles and track where your applications stand.
        </p>
        <HelpContact className="mt-3 text-left" />
      </header>

      {visibleCycles.length === 0 ? (
        <EmptyState applications={applications} />
      ) : (
        <div className="flex flex-col gap-8">
          {visibleCycles.map((cycle, cycleIndex) => (
            <CycleSection
              key={cycle.id}
              cycle={cycle}
              cycleColorIndex={cycleIndex}
              templates={openTemplatesByCycle[cycle.id] ?? []}
              applications={applications}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CycleSection({
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

  return (
    <section>
      <h2 className="text-text-default mb-3 text-sm font-semibold">
        Open roles
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {templates.map((template) => (
          <ApplicationRoleCard
            key={template.application_role}
            cycle={cycle}
            cycleColorIndex={cycleColorIndex}
            template={template}
            questionCount={
              summaries.find((s) => s.role === template.application_role)
                ?.question_count ?? 0
            }
            application={applications.find(
              (a) =>
                a.cycle_id === cycle.id && a.role === template.application_role
            )}
          />
        ))}
      </div>
    </section>
  )
}

function EmptyState({ applications }: { applications: Application[] }) {
  if (applications.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
        <p className="text-text-default text-sm font-medium">
          No open application cycles right now
        </p>
        <p className="text-text-muted mt-1 text-sm">
          Check back when recruitment opens.
        </p>
      </div>
    )
  }

  // No open cycles, but the applicant has past/in-flight applications.
  return (
    <div className="flex flex-col gap-3">
      <p className="text-text-muted text-sm">
        There are no open cycles right now. Your applications:
      </p>
      {applications.map((application) => {
        const status = APPLICANT_STATUS[application.stage]
        return (
          <div
            key={application.id}
            className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4"
          >
            <span
              className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${ROLE_CHIP_CLASS[application.role]}`}
            >
              {ROLE_LABEL[application.role]}
            </span>
            <span
              className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${status.className}`}
            >
              {status.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
