'use client'
import { PageContainer } from '@/components/PageContainer'

import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Application, Role, User } from '@/lib/api/types'
import { useApplicantsByNuids } from '@/lib/queries/applicants'
import { useApplications } from '@/lib/queries/applications'
import { pickDefaultCycleId, useCycles } from '@/lib/queries/cycles'
import {
  useAssignRecordingReviewer,
  useInterviewAssignmentsByApplications,
  useRecordingReviewerAssignmentsByApplications,
  useSetInterviewAssignment,
  useUnassignRecordingReviewer,
} from '@/lib/queries/interview-assignments'
import { useChiefs, useLeads } from '@/lib/queries/users'
import { ROLE_CHIP_CLASS, ROLE_COLUMNS, ROLE_LABEL } from '@/lib/roles'

export function InterviewAssignmentsClient() {
  const { data: cycles = [] } = useCycles({})
  const { data: allApplications = [] } = useApplications({})
  const { data: leads = [] } = useLeads()
  const { data: chiefs = [] } = useChiefs()

  // Scope the page to one cycle, same as the lead-assignment page.
  const [cycleId, setCycleId] = useState('')
  if (!cycleId && cycles.length > 0) {
    const defaultId = pickDefaultCycleId(cycles)
    if (defaultId) setCycleId(defaultId)
  }
  const [activeRole, setActiveRole] = useState<Role | 'all'>('all')

  const cycleApplications = useMemo(
    () =>
      allApplications.filter(
        (a) =>
          a.cycle_id === cycleId &&
          (activeRole === 'all' || a.role === activeRole)
      ),
    [allApplications, cycleId, activeRole]
  )

  // Interview assignment only makes sense for applicants a chief has actually
  // advanced to interview — everyone else hasn't cleared chief review yet.
  const applications = useMemo(
    () => cycleApplications.filter((a) => a.stage === 'interview'),
    [cycleApplications]
  )

  const nuids = useMemo(
    () => [...new Set(applications.map((a) => a.user_nuid))],
    [applications]
  )
  const applicantQueries = useApplicantsByNuids(nuids)
  const nameByNuid = useMemo(() => {
    const map: Record<string, string> = {}
    nuids.forEach((nuid, i) => {
      const data = applicantQueries[i]?.data
      if (data) map[nuid] = data.full_name
    })
    return map
  }, [nuids, applicantQueries])

  // Interviewer can be a lead or a chief (info.md), deduped in case someone
  // somehow holds both roles.
  const interviewers = useMemo(() => {
    const byNuid = new Map<string, User>()
    for (const u of [...leads, ...chiefs]) byNuid.set(u.nuid, u)
    return [...byNuid.values()]
  }, [leads, chiefs])
  const userName = useMemo(() => {
    const map: Record<string, string> = {}
    for (const u of interviewers) map[u.nuid] = u.full_name
    return map
  }, [interviewers])

  const appIds = useMemo(() => applications.map((a) => a.id), [applications])
  const assignmentQueries = useInterviewAssignmentsByApplications(appIds)
  const assignmentByApp = useMemo(() => {
    const map: Record<string, (typeof assignmentQueries)[number]['data']> = {}
    appIds.forEach((id, i) => {
      map[id] = assignmentQueries[i]?.data
    })
    return map
  }, [appIds, assignmentQueries])

  const reviewerQueries = useRecordingReviewerAssignmentsByApplications(appIds)
  const reviewersByApp = useMemo(() => {
    const map: Record<string, (typeof reviewerQueries)[number]['data']> = {}
    appIds.forEach((id, i) => {
      map[id] = reviewerQueries[i]?.data
    })
    return map
  }, [appIds, reviewerQueries])

  const setInterviewAssignment = useSetInterviewAssignment()
  const assignReviewer = useAssignRecordingReviewer()
  const unassignReviewer = useUnassignRecordingReviewer()

  return (
    <PageContainer>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-text-default text-2xl font-semibold">
            Interview assignments
          </h1>
          <p className="text-text-muted mt-1 text-sm">
            Assign one interviewer and recording reviewers to each applicant a
            chief has advanced.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={activeRole}
            onValueChange={(val) => setActiveRole(val as Role | 'all')}
          >
            <SelectTrigger className="w-56" aria-label="Filter by role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {ROLE_COLUMNS.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={cycleId} onValueChange={setCycleId}>
            <SelectTrigger className="w-40" aria-label="Filter by cycle">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {cycles.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {applications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
          <p className="text-text-default text-sm font-medium">
            No applicants to assign yet
          </p>
          <p className="text-text-muted mt-1 text-sm">
            Applicants show up here once a chief advances them to interview.
          </p>
        </div>
      ) : (
        ROLE_COLUMNS.map((role) => {
          const roleApps = applications.filter((a) => a.role === role)
          if (roleApps.length === 0) return null
          return (
            <section key={role}>
              <h2 className="text-text-default mb-3 text-sm font-semibold">
                {ROLE_LABEL[role]}{' '}
                <span className="text-text-faint font-normal">
                  ({roleApps.length})
                </span>
              </h2>
              <div className="flex flex-col gap-2">
                {roleApps.map((application) => (
                  <InterviewAssignmentRow
                    key={application.id}
                    application={application}
                    name={
                      nameByNuid[application.user_nuid] ?? application.user_nuid
                    }
                    interviewers={interviewers}
                    leads={leads}
                    userName={userName}
                    assignment={assignmentByApp[application.id]}
                    reviewers={reviewersByApp[application.id] ?? []}
                    onSetInterviewer={(interviewerNuid) =>
                      setInterviewAssignment.mutate({
                        applicationId: application.id,
                        interviewerNuid,
                      })
                    }
                    onAssignReviewer={(leadNuid) =>
                      assignReviewer.mutate({
                        applicationId: application.id,
                        leadNuid,
                      })
                    }
                    onUnassignReviewer={(id) =>
                      unassignReviewer.mutate({
                        id,
                        applicationId: application.id,
                      })
                    }
                  />
                ))}
              </div>
            </section>
          )
        })
      )}
    </PageContainer>
  )
}

function InterviewAssignmentRow({
  application,
  name,
  interviewers,
  leads,
  userName,
  assignment,
  reviewers,
  onSetInterviewer,
  onAssignReviewer,
  onUnassignReviewer,
}: {
  application: Application
  name: string
  interviewers: User[]
  leads: User[]
  userName: Record<string, string>
  assignment: { interviewer_nuid: string } | undefined
  reviewers: { id: string; lead_nuid: string }[]
  onSetInterviewer: (interviewerNuid: string) => void
  onAssignReviewer: (leadNuid: string) => void
  onUnassignReviewer: (id: string) => void
}) {
  const reviewerNuids = new Set(reviewers.map((r) => r.lead_nuid))
  const availableReviewers = leads.filter(
    (l) => !reviewerNuids.has(l.nuid) && l.nuid !== assignment?.interviewer_nuid
  )

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 items-center gap-2 sm:w-56 sm:shrink-0">
        <span className="text-text-default truncate text-sm font-medium">
          {name}
        </span>
        <span
          className={`inline-flex shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${ROLE_CHIP_CLASS[application.role]}`}
        >
          {ROLE_LABEL[application.role]}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-text-faint text-xs whitespace-nowrap">
          Interviewer
        </span>
        <Select
          value={assignment?.interviewer_nuid ?? ''}
          onValueChange={onSetInterviewer}
        >
          <SelectTrigger
            className="w-44"
            aria-label={`Interviewer for ${name}`}
          >
            <SelectValue placeholder="Unassigned" />
          </SelectTrigger>
          <SelectContent>
            {interviewers.map((u) => (
              <SelectItem key={u.nuid} value={u.nuid}>
                {u.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
        <span className="text-text-faint text-xs whitespace-nowrap">
          Recording reviewers
        </span>
        {reviewers.map((r) => (
          <span
            key={r.id}
            className="text-text-muted inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium"
          >
            {userName[r.lead_nuid] ?? r.lead_nuid}
            <button
              type="button"
              aria-label="Unassign"
              className="hover:text-destructive"
              onClick={() => onUnassignReviewer(r.id)}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        {availableReviewers.length > 0 && (
          <Select value="" onValueChange={onAssignReviewer}>
            <SelectTrigger
              className="h-7 w-36 text-xs"
              aria-label={`Add recording reviewer for ${name}`}
            >
              <SelectValue placeholder="+ Add reviewer" />
            </SelectTrigger>
            <SelectContent>
              {availableReviewers.map((u) => (
                <SelectItem key={u.nuid} value={u.nuid}>
                  {u.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  )
}
