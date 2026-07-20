'use client'

import { useMemo, useState } from 'react'
import { Loader2, Lock, Unlock, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Application, Role } from '@/lib/api/types'
import { useApplicantsByNuids } from '@/lib/queries/applicants'
import { useApplications } from '@/lib/queries/applications'
import { useCycles } from '@/lib/queries/cycles'
import {
  useAssignLead,
  useLeadAssignmentsByApplications,
  useUnassignLead,
} from '@/lib/queries/lead-assignments'
import {
  useReviewGates,
  useSetReviewRelease,
} from '@/lib/queries/review-releases'
import { useCurrentUser, useLeads } from '@/lib/queries/users'
import { ROLE_CHIP_CLASS, ROLE_COLUMNS, ROLE_LABEL } from '@/lib/roles'
import { REVIEWER_ACTOR } from '@/lib/stub-actor'

const OPTS = { actor: REVIEWER_ACTOR }

export function AssignmentsClient() {
  const { data: currentUser } = useCurrentUser()
  const { data: cycles = [] } = useCycles({}, OPTS)
  const { data: allApplications = [] } = useApplications({}, OPTS)
  const { data: leads = [] } = useLeads(OPTS)

  const isChief = !!currentUser?.roles.some(
    (r) => r === 'chief' || r === 'admin'
  )

  // Scope the page to one cycle so release (which is per cycle × role) is
  // unambiguous. Default to the first open cycle, else the first cycle.
  const [cycleId, setCycleId] = useState('')
  if (!cycleId && cycles.length > 0) {
    setCycleId((cycles.find((c) => c.status === 'open') ?? cycles[0]).id)
  }

  const applications = useMemo(
    () => allApplications.filter((a) => a.cycle_id === cycleId),
    [allApplications, cycleId]
  )

  const nuids = useMemo(
    () => [...new Set(applications.map((a) => a.user_nuid))],
    [applications]
  )
  const applicantQueries = useApplicantsByNuids(nuids, OPTS)
  const nameByNuid = useMemo(() => {
    const map: Record<string, string> = {}
    nuids.forEach((nuid, i) => {
      const data = applicantQueries[i]?.data
      if (data) map[nuid] = data.full_name
    })
    return map
  }, [nuids, applicantQueries])

  const leadName = useMemo(() => {
    const map: Record<string, string> = {}
    for (const lead of leads) map[lead.nuid] = lead.full_name
    return map
  }, [leads])

  const appIds = useMemo(() => applications.map((a) => a.id), [applications])
  const assignmentQueries = useLeadAssignmentsByApplications(appIds, OPTS)
  const assignmentsByApp = useMemo(() => {
    const map: Record<string, (typeof assignmentQueries)[number]['data']> = {}
    appIds.forEach((id, i) => {
      map[id] = assignmentQueries[i]?.data
    })
    return map
  }, [appIds, assignmentQueries])

  const { data: gates = [] } = useReviewGates(cycleId, OPTS)
  const assignLead = useAssignLead()
  const unassignLead = useUnassignLead()
  const setRelease = useSetReviewRelease()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [leadNuid, setLeadNuid] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [failed, setFailed] = useState(0)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function assignSelected() {
    if (!leadNuid || selected.size === 0) return
    setAssigning(true)
    setFailed(0)
    const results = await Promise.allSettled(
      [...selected].map((applicationId) =>
        assignLead.mutateAsync({ applicationId, leadNuid, opts: OPTS })
      )
    )
    const failures = results.filter(
      (r) =>
        r.status === 'rejected' &&
        !String((r.reason as Error)?.message).includes('409')
    ).length
    setFailed(failures)
    if (failures === 0) setSelected(new Set())
    setAssigning(false)
  }

  function releaseFor(role: Role, released: boolean) {
    setRelease.mutate({
      cycleId,
      body: { role, kind: 'written', released },
      opts: OPTS,
    })
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-text-default text-2xl font-semibold">
            Assign reviewers
          </h1>
          <p className="text-text-muted mt-1 text-sm">
            Assign leads to write-review applications, then release their
            reviews once everyone&apos;s in.
          </p>
        </div>
        <select
          aria-label="Cycle"
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-8 rounded-lg border bg-transparent px-2.5 text-sm outline-none focus-visible:ring-3"
          value={cycleId}
          onChange={(e) => setCycleId(e.target.value)}
        >
          {cycles.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Bulk toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-white p-4">
        <span className="text-text-faint text-sm">
          {selected.size} selected
        </span>
        {failed > 0 && (
          <span className="text-destructive text-sm">
            {failed} assignment{failed === 1 ? '' : 's'} failed
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <select
            aria-label="Lead to assign"
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-8 rounded-lg border bg-transparent px-2.5 text-sm outline-none focus-visible:ring-3"
            value={leadNuid}
            onChange={(e) => setLeadNuid(e.target.value)}
          >
            <option value="">Select a lead…</option>
            {leads.map((lead) => (
              <option key={lead.nuid} value={lead.nuid}>
                {lead.full_name}
              </option>
            ))}
          </select>
          <Button
            onClick={assignSelected}
            disabled={!leadNuid || selected.size === 0 || assigning}
          >
            {assigning ? (
              <>
                <Loader2 className="animate-spin" size={14} />
                Assigning…
              </>
            ) : (
              `Assign to ${selected.size || ''} selected`
            )}
          </Button>
        </div>
      </div>

      {applications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
          <p className="text-text-default text-sm font-medium">
            No applications in this cycle
          </p>
        </div>
      ) : (
        ROLE_COLUMNS.map((role) => {
          const roleApps = applications.filter((a) => a.role === role)
          const gate = gates.find(
            (g) => g.role === role && g.kind === 'written'
          )
          return (
            <section key={role}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-text-default text-sm font-semibold">
                  {ROLE_LABEL[role]}{' '}
                  <span className="text-text-faint font-normal">
                    ({roleApps.length})
                  </span>
                </h2>
                {isChief && gate && roleApps.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-text-muted text-xs">
                      {gate.submitted_count}/{gate.assigned_count} reviews in
                    </span>
                    {gate.released ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => releaseFor(role, false)}
                        disabled={setRelease.isPending}
                      >
                        <Lock size={14} />
                        Hide reviews
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => releaseFor(role, true)}
                        disabled={setRelease.isPending}
                      >
                        <Unlock size={14} />
                        Release reviews
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {roleApps.length === 0 ? (
                <p className="text-text-faint rounded-xl border border-dashed border-gray-200 bg-white px-4 py-6 text-center text-sm">
                  No {ROLE_LABEL[role].toLowerCase()} applications in this
                  cycle.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {roleApps.map((application) => (
                    <AssignmentRow
                      key={application.id}
                      application={application}
                      name={
                        nameByNuid[application.user_nuid] ??
                        application.user_nuid
                      }
                      assignments={assignmentsByApp[application.id] ?? []}
                      leadName={leadName}
                      selected={selected.has(application.id)}
                      onToggle={() => toggle(application.id)}
                      onUnassign={(id) =>
                        unassignLead.mutate({
                          id,
                          applicationId: application.id,
                          opts: OPTS,
                        })
                      }
                    />
                  ))}
                </div>
              )}
            </section>
          )
        })
      )}
    </div>
  )
}

function AssignmentRow({
  application,
  name,
  assignments,
  leadName,
  selected,
  onToggle,
  onUnassign,
}: {
  application: Application
  name: string
  assignments: { id: string; lead_nuid: string }[]
  leadName: Record<string, string>
  selected: boolean
  onToggle: () => void
  onUnassign: (assignmentId: string) => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4">
      <input
        type="checkbox"
        className="accent-primary"
        checked={selected}
        onChange={onToggle}
        aria-label={`Select ${name}`}
      />
      <span className="text-text-default text-sm font-medium">{name}</span>
      <span
        className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${ROLE_CHIP_CLASS[application.role]}`}
      >
        {ROLE_LABEL[application.role]}
      </span>

      <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
        {assignments.length === 0 ? (
          <span className="text-text-faint text-xs">Unassigned</span>
        ) : (
          assignments.map((a) => (
            <span
              key={a.id}
              className="text-text-muted inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium"
            >
              {leadName[a.lead_nuid] ?? a.lead_nuid}
              <button
                type="button"
                aria-label="Unassign"
                className="hover:text-destructive"
                onClick={() => onUnassign(a.id)}
              >
                <X size={12} />
              </button>
            </span>
          ))
        )}
      </div>
    </div>
  )
}
