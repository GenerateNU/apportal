'use client'
import { PageContainer } from '@/components/PageContainer'

import { useMemo, useState } from 'react'
import { Loader2, Trash2, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { InterviewGroupDetail } from '@/generated/model'
import { APIError } from '@/lib/api/client'
import type {
  Application,
  Interviewer,
  InterviewReviewer,
  Role,
  User,
} from '@/lib/api/types'
import { useApplications } from '@/lib/queries/applications'
import { pickDefaultCycleId, useCycles } from '@/lib/queries/cycles'
import {
  useAddInterviewReviewer,
  useAddInterviewer,
  useAssignInterviewGroup,
  useInterviewReviewersBulk,
  useRemoveInterviewReviewer,
  useRemoveInterviewer,
  useUnassignAllInterviewReviewers,
  useUnassignAllInterviewers,
} from '@/lib/queries/interview-assignments'
import { splitByGroup } from '@/lib/interview-groups'
import { useInterviewGroups } from '@/lib/queries/interview-groups'
import { useInterviewsByApplicationIds } from '@/lib/queries/interviews'
import { useChiefs, useLeads } from '@/lib/queries/users'
import { ROLE_CHIP_CLASS, ROLE_COLUMNS, ROLE_LABEL } from '@/lib/roles'

// Which "unassign all" confirmation dialog is open, if any.
type ConfirmingUnassignAll = { role: Role; kind: 'interviewers' | 'reviewers' }

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
  const { data: interviewsByApp } = useInterviewsByApplicationIds(appIds)
  const interviewersByApp = useMemo(() => {
    const map: Record<string, Interviewer[]> = {}
    for (const [id, iv] of Object.entries(interviewsByApp ?? {})) {
      map[id] = iv?.interviewers ?? []
    }
    return map
  }, [interviewsByApp])

  const { data: reviewersByApp = {} } = useInterviewReviewersBulk(appIds)
  const { data: groups = [] } = useInterviewGroups(cycleId)
  const interviewGroups = useMemo(
    () => groups.filter((g) => (g.members ?? []).length > 0),
    [groups]
  )
  const byGroup = interviewGroups.length > 0
  const assignGroup = useAssignInterviewGroup()

  const addInterviewer = useAddInterviewer()
  const removeInterviewer = useRemoveInterviewer()
  const addReviewer = useAddInterviewReviewer()
  const removeReviewer = useRemoveInterviewReviewer()
  const unassignAllInterviewers = useUnassignAllInterviewers()
  const unassignAllReviewers = useUnassignAllInterviewReviewers()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkInterviewerNuid, setBulkInterviewerNuid] = useState('')
  const [bulkReviewerNuid, setBulkReviewerNuid] = useState('')
  const [assigningInterviewers, setAssigningInterviewers] = useState(false)
  const [assigningReviewers, setAssigningReviewers] = useState(false)
  const [interviewerFailures, setInterviewerFailures] = useState(0)
  const [reviewerFailures, setReviewerFailures] = useState(0)
  const [confirmingUnassignAll, setConfirmingUnassignAll] =
    useState<ConfirmingUnassignAll | null>(null)
  const [removingGroup, setRemovingGroup] = useState<{
    applicantName: string
    groupName: string
    members: { id: string; name: string }[]
  } | null>(null)
  const [removingGroupPending, setRemovingGroupPending] = useState(false)
  const [removeGroupFailed, setRemoveGroupFailed] = useState(false)

  async function confirmRemoveGroup() {
    if (!removingGroup) return
    setRemovingGroupPending(true)
    setRemoveGroupFailed(false)
    const results = await Promise.allSettled(
      removingGroup.members.map((m) =>
        removeInterviewer.mutateAsync({ id: m.id })
      )
    )
    setRemovingGroupPending(false)
    if (results.some((r) => r.status === 'rejected')) {
      setRemoveGroupFailed(true)
      return
    }
    setRemovingGroup(null)
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const bulkInterviewerOptions = byGroup
    ? interviewGroups.map((g) => ({ value: g.id, label: g.name }))
    : interviewers.map((u) => ({ value: u.nuid, label: u.full_name }))
  const bulkInterviewerValue = bulkInterviewerOptions.some(
    (o) => o.value === bulkInterviewerNuid
  )
    ? bulkInterviewerNuid
    : ''

  async function assignInterviewerToSelected() {
    if (!bulkInterviewerValue || selected.size === 0) return
    setAssigningInterviewers(true)
    setInterviewerFailures(0)
    if (byGroup) {
      try {
        await assignGroup.mutateAsync({
          groupId: bulkInterviewerValue,
          applicationIds: [...selected],
        })
        setSelected(new Set())
      } catch {
        setInterviewerFailures(selected.size)
      }
      setAssigningInterviewers(false)
      return
    }
    const results = await Promise.allSettled(
      [...selected].map((applicationId) =>
        addInterviewer.mutateAsync({
          applicationId,
          interviewerNuid: bulkInterviewerValue,
        })
      )
    )
    const failures = results.filter(
      (r) => r.status === 'rejected' && !isConflict(r.reason)
    ).length
    setInterviewerFailures(failures)
    if (failures === 0) setSelected(new Set())
    setAssigningInterviewers(false)
  }

  async function assignReviewerToSelected() {
    if (!bulkReviewerNuid || selected.size === 0) return
    setAssigningReviewers(true)
    setReviewerFailures(0)
    const results = await Promise.allSettled(
      [...selected].map((applicationId) =>
        addReviewer.mutateAsync({
          applicationId,
          reviewerNuid: bulkReviewerNuid,
        })
      )
    )
    const failures = results.filter(
      (r) => r.status === 'rejected' && !isConflict(r.reason)
    ).length
    setReviewerFailures(failures)
    if (failures === 0) setSelected(new Set())
    setAssigningReviewers(false)
  }

  const unassigningAll =
    unassignAllInterviewers.isPending || unassignAllReviewers.isPending

  function confirmUnassignAll() {
    if (!confirmingUnassignAll) return
    const { role, kind } = confirmingUnassignAll
    const mutation =
      kind === 'interviewers' ? unassignAllInterviewers : unassignAllReviewers
    mutation.mutate(
      { cycleId, role },
      { onSuccess: () => setConfirmingUnassignAll(null) }
    )
  }

  return (
    <PageContainer>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-text-default text-2xl font-semibold">
            Interview assignments
          </h1>
          <p className="text-text-muted mt-1 text-sm">
            Assign interviewers and recording reviewers to each applicant a
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

      {/* Bulk toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-white p-4">
        <span className="text-text-faint text-sm">
          {selected.size} selected
        </span>
        {interviewerFailures > 0 && (
          <span className="text-destructive text-sm">
            {interviewerFailures} interviewer assignment
            {interviewerFailures === 1 ? '' : 's'} failed
          </span>
        )}
        {reviewerFailures > 0 && (
          <span className="text-destructive text-sm">
            {reviewerFailures} reviewer assignment
            {reviewerFailures === 1 ? '' : 's'} failed
          </span>
        )}
        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
          <Select
            value={bulkInterviewerValue}
            onValueChange={setBulkInterviewerNuid}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue
                placeholder={
                  byGroup ? 'Select a group…' : 'Select an interviewer…'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {bulkInterviewerOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={assignInterviewerToSelected}
            disabled={
              !bulkInterviewerValue ||
              selected.size === 0 ||
              assigningInterviewers
            }
          >
            {assigningInterviewers ? (
              <>
                <Loader2 className="animate-spin" size={14} />
                Assigning…
              </>
            ) : (
              `Add ${byGroup ? 'group' : 'interviewer'} to ${selected.size || ''} selected`
            )}
          </Button>
          <Select value={bulkReviewerNuid} onValueChange={setBulkReviewerNuid}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Select a reviewer…" />
            </SelectTrigger>
            <SelectContent>
              {leads.map((lead) => (
                <SelectItem key={lead.nuid} value={lead.nuid}>
                  {lead.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={assignReviewerToSelected}
            disabled={
              !bulkReviewerNuid || selected.size === 0 || assigningReviewers
            }
          >
            {assigningReviewers ? (
              <>
                <Loader2 className="animate-spin" size={14} />
                Assigning…
              </>
            ) : (
              `Add reviewer to ${selected.size || ''} selected`
            )}
          </Button>
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
          const roleHasInterviewers = roleApps.some(
            (a) => (interviewersByApp[a.id] ?? []).length > 0
          )
          const roleHasReviewers = roleApps.some(
            (a) => (reviewersByApp[a.id] ?? []).length > 0
          )
          return (
            <section key={role}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-text-default text-sm font-semibold">
                  {ROLE_LABEL[role]}{' '}
                  <span className="text-text-faint font-normal">
                    ({roleApps.length})
                  </span>
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  {roleHasInterviewers && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() =>
                        setConfirmingUnassignAll({ role, kind: 'interviewers' })
                      }
                    >
                      <Trash2 size={14} />
                      Unassign all interviewers
                    </Button>
                  )}
                  {roleHasReviewers && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() =>
                        setConfirmingUnassignAll({ role, kind: 'reviewers' })
                      }
                    >
                      <Trash2 size={14} />
                      Unassign all reviewers
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {roleApps.map((application) => (
                  <InterviewAssignmentRow
                    key={application.id}
                    application={application}
                    name={application.full_name || application.user_nuid}
                    interviewers={interviewers}
                    leads={leads}
                    userName={userName}
                    assignedInterviewers={
                      interviewersByApp[application.id] ?? []
                    }
                    groups={groups}
                    interviewGroups={byGroup ? interviewGroups : []}
                    reviewers={reviewersByApp[application.id] ?? []}
                    selected={selected.has(application.id)}
                    onToggleSelected={() => toggleSelected(application.id)}
                    onAddInterviewer={(value) =>
                      byGroup
                        ? assignGroup.mutate({
                            groupId: value,
                            applicationIds: [application.id],
                          })
                        : addInterviewer.mutate({
                            applicationId: application.id,
                            interviewerNuid: value,
                          })
                    }
                    onRemoveInterviewer={(id) =>
                      removeInterviewer.mutate({ id })
                    }
                    onRemoveGroup={(groupName, members) => {
                      setRemoveGroupFailed(false)
                      setRemovingGroup({
                        applicantName:
                          application.full_name || application.user_nuid,
                        groupName,
                        members,
                      })
                    }}
                    onAddReviewer={(reviewerNuid) =>
                      addReviewer.mutate({
                        applicationId: application.id,
                        reviewerNuid,
                      })
                    }
                    onRemoveReviewer={(id) => removeReviewer.mutate({ id })}
                  />
                ))}
              </div>
            </section>
          )
        })
      )}

      <Dialog
        open={!!removingGroup}
        onOpenChange={(open) => !open && setRemovingGroup(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Remove {removingGroup?.groupName} from{' '}
              {removingGroup?.applicantName}?
            </DialogTitle>
            <DialogDescription>
              {removingGroup?.members.map((m) => m.name).join(', ')} will no
              longer interview {removingGroup?.applicantName}. The group itself
              is kept.
            </DialogDescription>
          </DialogHeader>
          {removeGroupFailed && (
            <p className="text-destructive text-sm">
              Some interviewers couldn&apos;t be removed. Try again.
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemovingGroup(null)}
              disabled={removingGroupPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={removingGroupPending}
              onClick={confirmRemoveGroup}
            >
              {removingGroupPending && (
                <Loader2 className="animate-spin" size={14} />
              )}
              Remove group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!confirmingUnassignAll}
        onOpenChange={(open) => !open && setConfirmingUnassignAll(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Unassign all{' '}
              {confirmingUnassignAll?.kind === 'interviewers'
                ? 'interviewers'
                : 'reviewers'}
              ?
            </DialogTitle>
            <DialogDescription>
              This removes every{' '}
              {confirmingUnassignAll?.kind === 'interviewers'
                ? 'interviewer'
                : 'recording-review'}{' '}
              assignment for{' '}
              {confirmingUnassignAll &&
                ROLE_LABEL[confirmingUnassignAll.role].toLowerCase()}{' '}
              applicants in this cycle, except{' '}
              {confirmingUnassignAll?.kind === 'interviewers'
                ? 'on interviews already conducted'
                : 'reviewers who already submitted'}
              . This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmingUnassignAll(null)}
              disabled={unassigningAll}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={unassigningAll}
              onClick={confirmUnassignAll}
            >
              {unassigningAll && <Loader2 className="animate-spin" size={14} />}
              Unassign all
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}

function isConflict(err: unknown) {
  return err instanceof APIError && err.status === 409
}

function InterviewAssignmentRow({
  application,
  name,
  interviewers,
  leads,
  userName,
  assignedInterviewers,
  groups,
  interviewGroups,
  reviewers,
  selected,
  onToggleSelected,
  onAddInterviewer,
  onRemoveInterviewer,
  onRemoveGroup,
  onAddReviewer,
  onRemoveReviewer,
}: {
  application: Application
  name: string
  interviewers: User[]
  leads: User[]
  userName: Record<string, string>
  assignedInterviewers: Interviewer[]
  groups: InterviewGroupDetail[]
  interviewGroups: InterviewGroupDetail[]
  reviewers: InterviewReviewer[]
  selected: boolean
  onToggleSelected: () => void
  onAddInterviewer: (interviewerNuid: string) => void
  onRemoveInterviewer: (id: string) => void
  onRemoveGroup: (
    groupName: string,
    members: { id: string; name: string }[]
  ) => void
  onAddReviewer: (reviewerNuid: string) => void
  onRemoveReviewer: (id: string) => void
}) {
  const interviewerNuids = new Set(
    assignedInterviewers.map((x) => x.interviewer_nuid)
  )
  const reviewerNuids = new Set(reviewers.map((r) => r.reviewer_nuid))
  const { groupBlocks, solo } = splitByGroup(assignedInterviewers, groups)
  const interviewerLabel = (x: Interviewer) =>
    x.interviewer_name ?? userName[x.interviewer_nuid] ?? x.interviewer_nuid
  const availableInterviewers =
    interviewGroups.length > 0
      ? interviewGroups
          .filter((g) => {
            const nuids = (g.members ?? []).map((m) => m.member_nuid)
            return (
              !nuids.every((n) => interviewerNuids.has(n)) &&
              !nuids.some((n) => reviewerNuids.has(n))
            )
          })
          .map((g) => ({ value: g.id, label: g.name }))
      : interviewers
          .filter(
            (u) => !interviewerNuids.has(u.nuid) && !reviewerNuids.has(u.nuid)
          )
          .map((u) => ({ value: u.nuid, label: u.full_name }))
  const availableReviewers = leads
    .filter((l) => !reviewerNuids.has(l.nuid) && !interviewerNuids.has(l.nuid))
    .map((l) => ({ value: l.nuid, label: l.full_name }))

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 items-center gap-2 sm:w-56 sm:shrink-0">
        <input
          type="checkbox"
          className="accent-primary size-4 shrink-0"
          checked={selected}
          onChange={onToggleSelected}
          aria-label={`Select ${name}`}
        />
        <span className="text-text-default truncate text-sm font-medium">
          {name}
        </span>
        <span
          className={`inline-flex shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${ROLE_CHIP_CLASS[application.role]}`}
        >
          {ROLE_LABEL[application.role]}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-text-faint text-xs whitespace-nowrap">
          Interviewers
        </span>
        {groupBlocks.map(({ group, members }) => (
          <div
            key={group.id}
            className="flex flex-col gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5"
          >
            <div className="flex items-center gap-1.5">
              <Users size={12} className="text-text-faint" />
              <span className="text-text-default text-xs font-semibold">
                {group.name}
              </span>
              <button
                type="button"
                aria-label={`Remove ${group.name} from ${name}`}
                className="text-text-faint hover:text-destructive -m-1 ml-auto p-1"
                onClick={() =>
                  onRemoveGroup(
                    group.name,
                    members.map((m) => ({
                      id: m.id,
                      name: interviewerLabel(m),
                    }))
                  )
                }
              >
                <X size={12} />
              </button>
            </div>
            <ul className="text-text-muted flex flex-col text-xs">
              {members.map((m) => (
                <li key={m.id}>{interviewerLabel(m)}</li>
              ))}
            </ul>
          </div>
        ))}
        <AssigneeChips
          label=""
          name={name}
          chips={solo.map((x) => ({ id: x.id, label: interviewerLabel(x) }))}
          options={availableInterviewers}
          addLabel={
            interviewGroups.length > 0 ? '+ Add group' : '+ Add interviewer'
          }
          onAdd={onAddInterviewer}
          onRemove={onRemoveInterviewer}
        />
      </div>

      <div className="sm:ml-auto">
        <AssigneeChips
          label="Recording reviewers"
          name={name}
          chips={reviewers.map((r) => ({
            id: r.id,
            label:
              r.reviewer_name ?? userName[r.reviewer_nuid] ?? r.reviewer_nuid,
          }))}
          options={availableReviewers}
          addLabel="+ Add reviewer"
          onAdd={onAddReviewer}
          onRemove={onRemoveReviewer}
        />
      </div>
    </div>
  )
}

function AssigneeChips({
  label,
  name,
  chips,
  options,
  addLabel,
  onAdd,
  onRemove,
}: {
  label: string
  name: string
  chips: { id: string; label: string }[]
  options: { value: string; label: string }[]
  addLabel: string
  onAdd: (nuid: string) => void
  onRemove: (id: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {label && (
        <span className="text-text-faint text-xs whitespace-nowrap">
          {label}
        </span>
      )}
      {chips.map((c) => (
        <span
          key={c.id}
          className="text-text-muted inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium"
        >
          {c.label}
          <button
            type="button"
            aria-label={`Remove ${c.label}`}
            className="hover:text-destructive -m-1 p-1"
            onClick={() => onRemove(c.id)}
          >
            <X size={12} />
          </button>
        </span>
      ))}
      {options.length > 0 && (
        <Select value="" onValueChange={onAdd}>
          <SelectTrigger
            className="h-7 w-36 text-xs"
            aria-label={`${addLabel.replace('+ ', '')} for ${name}`}
          >
            <SelectValue placeholder={addLabel} />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
