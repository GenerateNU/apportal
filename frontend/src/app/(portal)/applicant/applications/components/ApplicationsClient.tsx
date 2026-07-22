'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Application, Cycle, Role, User } from '@/lib/api/types'
import { useApplications } from '@/lib/queries/applications'
import { useOpenApplicationTemplates } from '@/lib/queries/application-templates'
import { useCycles } from '@/lib/queries/cycles'
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
  const actor = { nuid: user.nuid, role: 'applicant' }
  const { data: cycles = [] } = useCycles({}, { actor })
  const { data: applications = [] } = useApplications(
    { user_nuid: user.nuid },
    { actor }
  )

  // Which roles are actually visible ("cycle open AND its own template open")
  // is decided entirely server-side by list-open-application-templates — this
  // just groups the already-filtered rows by cycle for rendering.
  // opens_at/closes_at are currently just metadata — nothing auto-opens/closes.
  // TODO: decide how to honor opens_at/closes_at, e.g. by folding an
  // "effective open" window check into that same backend query.
  const { data: openTemplates = [] } = useOpenApplicationTemplates({ actor })

  const openRolesByCycle = useMemo(() => {
    const map: Record<string, Role[]> = {}
    openTemplates.forEach((template) => {
      const roles = (map[template.cycle_id] ??= [])
      roles.push(template.application_role)
    })
    return map
  }, [openTemplates])

  const visibleCycles = useMemo(
    () => cycles.filter((cycle) => openRolesByCycle[cycle.id]?.length),
    [cycles, openRolesByCycle]
  )

  return (
    <div className="mx-auto w-full max-w-3xl px-8 py-10">
      <header className="mb-8">
        <h1 className="text-text-default text-2xl font-semibold">
          My Applications
        </h1>
        <p className="text-text-muted mt-1 text-sm">
          Apply to open roles and track where your applications stand.
        </p>
      </header>

      {visibleCycles.length === 0 ? (
        <EmptyState applications={applications} />
      ) : (
        <div className="flex flex-col gap-8">
          {visibleCycles.map((cycle) => (
            <CycleSection
              key={cycle.id}
              cycle={cycle}
              roles={openRolesByCycle[cycle.id] ?? []}
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
  roles,
  applications,
}: {
  cycle: Cycle
  roles: Role[]
  applications: Application[]
}) {
  return (
    <section>
      <h2 className="text-text-default mb-3 text-sm font-semibold">
        {cycle.name}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {roles.map((role) => (
          <RoleCard
            key={role}
            cycle={cycle}
            role={role}
            application={applications.find(
              (a) => a.cycle_id === cycle.id && a.role === role
            )}
          />
        ))}
      </div>
    </section>
  )
}

function RoleCard({
  cycle,
  role,
  application,
}: {
  cycle: Cycle
  role: Role
  application?: Application
}) {
  const router = useRouter()
  const status = application ? APPLICANT_STATUS[application.stage] : null

  return (
    <div className="flex flex-col justify-between rounded-xl border border-gray-100 bg-white p-5">
      <div className="mb-6 flex items-start justify-between gap-2">
        <span
          className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${ROLE_CHIP_CLASS[role]}`}
        >
          {ROLE_LABEL[role]}
        </span>
        {status && (
          <span
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${status.className}`}
          >
            <Check size={12} />
            {status.label}
          </span>
        )}
      </div>

      {application ? (
        <Button
          variant="outline"
          onClick={() =>
            router.push(`/applicant/applications/${application.id}`)
          }
        >
          View application
          <ArrowRight data-icon="inline-end" size={14} />
        </Button>
      ) : (
        <Button
          onClick={() =>
            router.push(
              `/applicant/applications/new?cycle=${cycle.id}&role=${role}`
            )
          }
        >
          Apply
          <ArrowRight data-icon="inline-end" size={14} />
        </Button>
      )}
    </div>
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
