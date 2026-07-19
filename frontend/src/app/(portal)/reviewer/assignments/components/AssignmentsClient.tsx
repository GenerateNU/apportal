'use client'

import { useMemo, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useApplicantsByNuids } from '@/lib/queries/applicants'
import { useApplications } from '@/lib/queries/applications'
import {
  useAssignLead,
  useLeadAssignmentsByApplications,
  useUnassignLead,
} from '@/lib/queries/lead-assignments'
import { useLeads } from '@/lib/queries/users'
import { ROLE_CHIP_CLASS, ROLE_LABEL } from '@/lib/roles'
import { REVIEWER_ACTOR } from '@/lib/stub-actor'

const OPTS = { actor: REVIEWER_ACTOR }

export function AssignmentsClient() {
  const { data: applications = [] } = useApplications({}, OPTS)
  const { data: leads = [] } = useLeads(OPTS)

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

  const assignLead = useAssignLead()
  const unassignLead = useUnassignLead()

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
    // Bulk: assign the chosen lead to every selected application. A pair that's
    // already assigned returns 409; anything else (e.g. a bad reference) is a
    // real failure we surface rather than swallow.
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

  const allSelected =
    applications.length > 0 && selected.size === applications.length

  return (
    <div className="flex flex-col gap-6 p-8">
      <div>
        <h1 className="text-text-default text-2xl font-semibold">
          Assign reviewers
        </h1>
        <p className="text-text-muted mt-1 text-sm">
          Assign leads to write-review applications. Select applications, pick a
          lead, and assign them in bulk.
        </p>
      </div>

      {/* Bulk toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-white p-4">
        <label className="text-text-muted flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-primary"
            checked={allSelected}
            onChange={() =>
              setSelected(
                allSelected ? new Set() : new Set(applications.map((a) => a.id))
              )
            }
          />
          Select all
        </label>
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
            No applications yet
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {applications.map((application) => {
            const assignments = assignmentsByApp[application.id] ?? []
            return (
              <div
                key={application.id}
                className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4"
              >
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={selected.has(application.id)}
                  onChange={() => toggle(application.id)}
                  aria-label={`Select ${nameByNuid[application.user_nuid] ?? application.user_nuid}`}
                />
                <div className="flex items-center gap-2">
                  <span className="text-text-default text-sm font-medium">
                    {nameByNuid[application.user_nuid] ?? application.user_nuid}
                  </span>
                  <span
                    className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${ROLE_CHIP_CLASS[application.role]}`}
                  >
                    {ROLE_LABEL[application.role]}
                  </span>
                </div>

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
                          onClick={() =>
                            unassignLead.mutate({
                              id: a.id,
                              applicationId: application.id,
                              opts: OPTS,
                            })
                          }
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
