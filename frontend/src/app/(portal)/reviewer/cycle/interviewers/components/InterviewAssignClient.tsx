'use client'

import { useState } from 'react'
import { Check, Plus, Sparkles, Users, X } from 'lucide-react'
import { Tooltip } from '@/components/Tooltip'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DateTimePicker } from '@/components/ui/datetime-picker'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingText } from '@/components/ui/loading-text'
import { PageHeader } from '@/components/ui/page-header'
import { PAGE_SHELL } from '@/components/ui/page-shell'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { useToast } from '@/components/ui/toast'
import type { InterviewPlan } from '@/generated/model/interviewPlan'
import { useCycleScope } from '@/hooks/useCycleScope'
import { apiErrorDetail } from '@/lib/api/client'
import { formatDeadline } from '@/lib/deadline'
import { useCycleStaff } from '@/lib/queries/cycle-staff'
import {
  useInterviewPanelMutations,
  useInterviewPanels,
} from '@/lib/queries/interview-panels'
import { useMeetingSlots, useStaffSlots } from '@/lib/queries/meeting-slots'
import {
  dueAt,
  perApplicant,
  released as isReleased,
  useCycleSteps,
  usePipeline,
  usePipelineMutations,
} from '@/lib/queries/pipeline'
import {
  type InterviewEntry,
  type Kind,
  type Person,
  useInterviewBoard,
  useInterviewBoardMutations,
} from '@/lib/queries/interview-board'
import { useReviewConflicts, useStaffing } from '@/lib/queries/reviewer-pools'
import { cn } from '@/lib/utils'
import { ConflictsButton } from '../../reviews/components/ReviewsClient'

export function useInterviewSetup(cycleId: string) {
  const { data: steps = [] } = useCycleSteps(cycleId)
  const recEach = perApplicant(steps, 'interviews', 'recording_reviewer')
  return {
    ivEach: perApplicant(steps, 'interviews', 'interviewer'),
    withRecording: recEach > 0,
    recEach,
  }
}

export function InterviewAssignClient() {
  const scope = useCycleScope()
  const { withRecording } = useInterviewSetup(scope.cycleId)
  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        title={
          withRecording
            ? 'Assign interviewers & reviewers'
            : 'Assign interviewers'
        }
        subtitle={
          withRecording
            ? 'Pick who interviews each applicant and who reviews the recording after. Auto-assign spreads the load and never has anyone review their own interview.'
            : 'Pick who interviews each applicant. Auto-assign spreads interviews evenly and skips conflicts of interest.'
        }
        actions={
          scope.cycleId && (
            <span className="flex items-center gap-2">
              <PanelsButton cycleId={scope.cycleId} />
              <ConflictsButton cycleId={scope.cycleId} />
            </span>
          )
        }
      />
      {!scope.cycleId || !scope.roleId ? (
        scope.isLoading ? (
          <LoadingText />
        ) : (
          <EmptyState title="Add an opening first" />
        )
      ) : (
        <Board
          cycleId={scope.cycleId}
          roleIds={scope.roles.roleIds}
          roleLabel={scope.roles.roleLabel}
          roleId={scope.roleId}
          setRoleId={scope.setRoleId}
        />
      )}
    </div>
  )
}

function Board({
  cycleId,
  roleIds,
  roleLabel,
  roleId,
  setRoleId,
}: {
  cycleId: string
  roleIds: string[]
  roleLabel: (id: string) => string
  roleId: string
  setRoleId: (id: string) => void
}) {
  const { data: board = [], isLoading } = useInterviewBoard(cycleId)
  const { data: staffing } = useStaffing(cycleId)
  const { data: conflicts = [] } = useReviewConflicts(cycleId)
  const { data: staff = [] } = useCycleStaff(cycleId)
  const { ivEach, withRecording, recEach } = useInterviewSetup(cycleId)
  const m = useInterviewBoardMutations(cycleId)
  const toast = useToast()
  const [plan, setPlan] = useState<InterviewPlan | null>(null)
  const [onlyShort, setOnlyShort] = useState(false)
  const [clearing, setClearing] = useState(false)
  const { data: panels = [] } = useInterviewPanels(cycleId)
  const usable = panels.filter((g) => (g.members ?? []).length > 0)
  const panelMode = usable.length > 0
  const { data: pipeline } = usePipeline(cycleId)
  const released = isReleased(pipeline, 'interviews', roleId)
  const interviewDue = dueAt(pipeline, 'interviews', roleId, 'interviewer')
  const editable = !plan && !released
  const { data: days = new Map<string, string>() } = useStaffSlots(cycleId)
  const { data: meetingSlots = [] } = useMeetingSlots(cycleId)
  const { cycle } = useCycleScope()
  const slotLabel = labelFor(meetingSlots)
  const matching = !!cycle?.match_by_slot
  const missedDay = new Set(plan?.no_slot_match ?? [])
  const noSharedDay = (r: InterviewEntry) => {
    if (missedDay.has(r.applicationId)) return true
    const assigned = r.interviewers.map((x) => days.get(x.nuid) ?? '')
    return (
      r.available.length > 0 &&
      assigned.length > 0 &&
      assigned.every((d) => d) &&
      !assigned.some((d) => r.available.includes(d))
    )
  }
  const teams = usable.map((g) => ({
    id: g.id,
    name: g.name,
    members: (g.members ?? []).map((x) => x.user_nuid),
  }))

  const proposed = (kind: Kind) => {
    const map = new Map<string, string[]>()
    for (const p of (kind === 'interviewers'
      ? plan?.interviewers
      : plan?.recording_reviewers) ?? [])
      map.set(p.application_id, [...(map.get(p.application_id) ?? []), p.nuid])
    return map
  }
  const newIv = proposed('interviewers')
  const newRec = proposed('reviewers')
  const names = new Map<string, string>()
  for (const p of staff) names.set(p.user_nuid, p.full_name)
  for (const r of board)
    for (const x of [...r.interviewers, ...r.reviewers])
      names.set(x.nuid, x.name)
  for (const p of [
    ...(plan?.interviewers ?? []),
    ...(plan?.recording_reviewers ?? []),
  ])
    names.set(p.nuid, p.full_name)
  const nameOf = (nuid: string) => names.get(nuid) ?? nuid

  const ivNeed = (r: InterviewEntry) =>
    Math.max(
      0,
      ivEach - r.interviewers.length - (newIv.get(r.applicationId)?.length ?? 0)
    )
  const recNeed = (r: InterviewEntry) =>
    withRecording
      ? Math.max(
          0,
          recEach -
            r.reviewers.length -
            (newRec.get(r.applicationId)?.length ?? 0)
        )
      : 0
  const short = (r: InterviewEntry) => !r.done && ivNeed(r) + recNeed(r) > 0
  const shortIn = (id: string) =>
    board.filter((r) => r.roleId === id && short(r)).length

  const rows = board.filter((r) => r.roleId === roleId)
  const shown = onlyShort ? rows.filter(short) : rows
  const added =
    (plan?.interviewers?.length ?? 0) + (plan?.recording_reviewers?.length ?? 0)
  const stillShort = new Set([
    ...(plan?.short_interviewers ?? []),
    ...(plan?.short_recording ?? []),
  ]).size
  const notes = [
    ...(plan?.warnings ?? []),
    ...(stillShort > 0
      ? [
          `${stillShort} applicant${stillShort === 1 ? '' : 's'} will still be short.`,
        ]
      : []),
  ]
  const removable = rows.some(
    (r) => !r.done && r.interviewers.length + r.reviewers.length > 0
  )

  const load = new Map<
    string,
    { iv: number; ivPlus: number; rec: number; recPlus: number }
  >()
  const bump = (nuid: string, key: 'iv' | 'ivPlus' | 'rec' | 'recPlus') => {
    const cur = load.get(nuid) ?? { iv: 0, ivPlus: 0, rec: 0, recPlus: 0 }
    cur[key]++
    load.set(nuid, cur)
  }
  for (const p of staffing?.positions ?? [])
    for (const n of p.interviewers ?? [])
      if (!load.has(n)) load.set(n, { iv: 0, ivPlus: 0, rec: 0, recPlus: 0 })
  for (const r of board) {
    r.interviewers.forEach((x) => bump(x.nuid, 'iv'))
    r.reviewers.forEach((x) => bump(x.nuid, 'rec'))
  }
  for (const p of plan?.interviewers ?? []) bump(p.nuid, 'ivPlus')
  for (const p of plan?.recording_reviewers ?? []) bump(p.nuid, 'recPlus')
  const loads = [...load.entries()]
    .map(([nuid, l]) => ({
      nuid,
      name: nameOf(nuid),
      ...l,
      total: l.iv + l.ivPlus + l.rec + l.recPlus,
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
  const most = Math.max(1, ...loads.map((l) => l.total))

  async function run(p: Promise<unknown>) {
    try {
      await p
    } catch (err) {
      toast(apiErrorDetail(err), { variant: 'error' })
    }
  }

  async function autoAssign(dryRun: boolean) {
    try {
      const result = await m.auto.mutateAsync({
        roleIds: [roleId],
        withRecording,
        byPanel: panelMode,
        matchSlots: matching,
        dryRun,
      })
      const n =
        (result.interviewers?.length ?? 0) +
        (result.recording_reviewers?.length ?? 0)
      if (dryRun) {
        if (n) return setPlan(result)
        return toast(
          "Auto-assign can't fill the rest. Check the team and conflicts, or add by hand."
        )
      }
      toast(`Assigned ${n}`)
      setPlan(null)
    } catch (err) {
      toast(apiErrorDetail(err), { variant: 'error' })
    }
  }

  async function clear() {
    try {
      await m.clear.mutateAsync({ roleId, reviewers: withRecording })
      setClearing(false)
      toast('Cleared')
    } catch (err) {
      toast(apiErrorDetail(err), { variant: 'error' })
    }
  }

  if (isLoading) return <LoadingText />

  const eligible = (id: string) =>
    staffing?.positions.find((p) => p.role_id === id)?.interviewers ?? []
  const blocked = (r: InterviewEntry) =>
    conflicts
      .filter((c) => c.applicant_nuid === r.applicantNuid)
      .map((c) => c.lead_nuid)

  return (
    <div className="flex flex-col gap-4">
      {plan && (
        <div className="flex flex-col gap-2 border border-emerald-300 bg-emerald-50/60 px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-emerald-900">
              Previewing {plan.interviewers?.length ?? 0} interviewer
              {(plan.interviewers?.length ?? 0) === 1 ? '' : 's'}
              {withRecording &&
                ` and ${plan.recording_reviewers?.length ?? 0} recording reviewer${(plan.recording_reviewers?.length ?? 0) === 1 ? '' : 's'}`}{' '}
              for {roleLabel(roleId)}. Nothing is saved yet.
            </span>
            <span className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPlan(null)}>
                Discard
              </Button>
              <Button
                size="sm"
                disabled={added === 0 || m.auto.isPending}
                onClick={() => autoAssign(false)}
              >
                Apply
              </Button>
            </span>
          </div>
          {notes.map((n) => (
            <p key={n} className="text-xs text-amber-700">
              {n}
            </p>
          ))}
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_17rem]">
        <Card padding="none">
          <div className="flex flex-wrap items-center gap-x-6 border-b border-gray-200 px-5">
            {roleIds.length > 1 && (
              <nav className="flex gap-6 overflow-x-auto">
                {roleIds.map((id) => {
                  const n = shortIn(id)
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setRoleId(id)
                        setPlan(null)
                        setOnlyShort(false)
                      }}
                      className={cn(
                        '-mb-px flex shrink-0 items-center gap-1.5 border-b-2 py-3 text-sm font-medium transition-colors',
                        id === roleId
                          ? 'border-ink text-ink'
                          : 'text-text-muted hover:text-ink border-transparent'
                      )}
                    >
                      {roleLabel(id)}
                      {n > 0 && (
                        <span className="text-xs font-normal text-amber-600 tabular-nums">
                          {n} short
                        </span>
                      )}
                    </button>
                  )
                })}
              </nav>
            )}
            <span className="ml-auto flex shrink-0 items-center gap-2 py-2">
              {editable && panelMode && (
                <Tooltip label="Each applicant gets one whole interview panel. Delete the panels to assign people one by one.">
                  <span className="text-text-subtle text-xs">
                    by interview panel · {usable.length}
                  </span>
                </Tooltip>
              )}
              {editable && removable && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setClearing(true)}
                >
                  Clear
                </Button>
              )}
              {editable &&
                (shortIn(roleId) === 0 ? (
                  <Tooltip label="Everyone has enough people">
                    <Button size="sm" disabled>
                      <Sparkles /> Preview auto-assign
                    </Button>
                  </Tooltip>
                ) : (
                  <Button
                    size="sm"
                    disabled={m.auto.isPending}
                    onClick={() => autoAssign(true)}
                  >
                    <Sparkles /> Preview auto-assign
                  </Button>
                ))}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-2">
            <nav className="flex gap-1">
              {(
                [
                  [false, 'All', rows.length],
                  [true, 'Short', shortIn(roleId)],
                ] as const
              ).map(([value, label, n]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setOnlyShort(value)}
                  className={cn(
                    'px-3 py-1 text-sm transition-colors',
                    onlyShort === value
                      ? 'bg-ink text-white'
                      : 'text-text-muted hover:text-ink hover:bg-gray-50'
                  )}
                >
                  {label}
                  <span
                    className={cn(
                      'ml-1.5 tabular-nums',
                      onlyShort !== value && value && n > 0 && 'text-amber-600'
                    )}
                  >
                    {n}
                  </span>
                </button>
              ))}
            </nav>
            <ReleaseInterviews
              cycleId={cycleId}
              roleId={roleId}
              name={roleLabel(roleId)}
              released={released}
              hasDue={!!interviewDue}
              assigned={rows.some((r) => r.interviewers.length > 0)}
              withRecording={withRecording}
            />
          </div>

          {rows.length > 0 && (
            <div
              className={cn(
                'text-text-subtle grid items-baseline gap-4 border-b border-gray-100 px-5 py-1.5 text-xs',
                withRecording
                  ? 'grid-cols-[12rem_1fr_1fr]'
                  : 'grid-cols-[12rem_1fr_auto]'
              )}
            >
              <span>Applicant</span>
              <span className="flex flex-wrap items-baseline gap-x-2">
                Interviewers · {ivEach} each
                <DueLink
                  cycleId={cycleId}
                  roleId={roleId}
                  field="interview_closes_at"
                />
              </span>
              {withRecording ? (
                <span className="flex flex-wrap items-baseline gap-x-2">
                  Recording reviewers · {recEach} each
                  <DueLink
                    cycleId={cycleId}
                    roleId={roleId}
                    field="interview_review_closes_at"
                  />
                </span>
              ) : (
                <span />
              )}
            </div>
          )}

          {shown.length === 0 ? (
            <p className="text-text-subtle px-5 py-6 text-center text-sm">
              {rows.length === 0
                ? 'No one is in interviews for this opening yet. Advance applicants on Shortlist.'
                : 'Everyone has enough people.'}
            </p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              {shown.map((r) => {
                const off = new Set(blocked(r))
                return (
                  <div
                    key={r.applicationId}
                    className={cn(
                      'grid items-center gap-4 border-b border-gray-100 px-5 py-1.5 last:border-b-0',
                      withRecording
                        ? 'grid-cols-[12rem_1fr_1fr]'
                        : 'grid-cols-[12rem_1fr_auto]'
                    )}
                  >
                    <span
                      className={cn(
                        'flex min-w-0 items-center gap-1.5 truncate text-sm font-medium',
                        r.done ? 'text-text-muted' : 'text-ink'
                      )}
                      title={interviewStatus(r)}
                    >
                      {r.done && (
                        <Check
                          size={13}
                          strokeWidth={3}
                          className="shrink-0 text-emerald-600"
                        />
                      )}
                      <span className="truncate">{r.name}</span>
                      {matching && (
                        <span className="flex shrink-0 gap-0.5">
                          {r.available.length === 0 ? (
                            <span className="text-text-faint text-[10px]">
                              no days
                            </span>
                          ) : (
                            r.available.map((d) => (
                              <span
                                key={d}
                                className="text-text-muted bg-gray-100 px-1 text-[10px] font-normal"
                              >
                                {slotLabel(d)}
                              </span>
                            ))
                          )}
                        </span>
                      )}
                      {matching && !r.done && noSharedDay(r) && (
                        <span className="shrink-0 text-[10px] font-normal text-amber-600">
                          No shared day
                        </span>
                      )}
                    </span>
                    <Chips
                      people={r.interviewers}
                      proposed={newIv.get(r.applicationId) ?? []}
                      need={ivNeed(r)}
                      locked={r.done || released}
                      canAdd={editable}
                      nameOf={nameOf}
                      dayOf={
                        matching
                          ? (n) =>
                              days.get(n) ? slotLabel(days.get(n)!) : undefined
                          : undefined
                      }
                      options={eligible(r.roleId).filter(
                        (n) =>
                          !off.has(n) &&
                          !r.interviewers.some((x) => x.nuid === n) &&
                          !r.reviewers.some((x) => x.nuid === n)
                      )}
                      teams={teams}
                      panelOptions={usable
                        .filter((g) =>
                          (g.members ?? []).every(
                            (x) =>
                              !off.has(x.user_nuid) &&
                              eligible(r.roleId).includes(x.user_nuid) &&
                              !r.interviewers.some(
                                (i) => i.nuid === x.user_nuid
                              )
                          )
                        )
                        .map((g) => ({
                          value: `panel:${g.id}`,
                          label: `Panel · ${g.name}`,
                        }))}
                      label={`Add an interviewer for ${r.name}`}
                      onAdd={(value) =>
                        run(
                          (async () => {
                            const panel = value.startsWith('panel:')
                              ? usable.find((g) => `panel:${g.id}` === value)
                              : null
                            const nuids = panel
                              ? (panel.members ?? []).map((x) => x.user_nuid)
                              : [value]
                            for (const nuid of nuids)
                              await m.add.mutateAsync({
                                kind: 'interviewers',
                                applicationId: r.applicationId,
                                nuid,
                              })
                          })()
                        )
                      }
                      onRemove={(ids) =>
                        run(
                          (async () => {
                            for (const id of ids)
                              await m.remove.mutateAsync({
                                kind: 'interviewers',
                                assignmentId: id,
                              })
                          })()
                        )
                      }
                    />
                    {withRecording ? (
                      <Chips
                        people={r.reviewers}
                        proposed={newRec.get(r.applicationId) ?? []}
                        need={recNeed(r)}
                        locked={released}
                        canAdd={editable}
                        nameOf={nameOf}
                        options={eligible(r.roleId).filter(
                          (n) =>
                            !off.has(n) &&
                            !r.interviewers.some((x) => x.nuid === n) &&
                            !r.reviewers.some((x) => x.nuid === n)
                        )}
                        label={`Add a recording reviewer for ${r.name}`}
                        onAdd={(nuid) =>
                          run(
                            m.add.mutateAsync({
                              kind: 'reviewers',
                              applicationId: r.applicationId,
                              nuid,
                            })
                          )
                        }
                        onRemove={(ids) =>
                          run(
                            (async () => {
                              for (const id of ids)
                                await m.remove.mutateAsync({
                                  kind: 'reviewers',
                                  assignmentId: id,
                                })
                            })()
                          )
                        }
                      />
                    ) : (
                      <span className="w-16 text-right text-xs">
                        {ivNeed(r) > 0 && !r.done ? (
                          <span className="text-amber-600">
                            Needs {ivNeed(r)}
                          </span>
                        ) : (
                          <Check
                            size={13}
                            strokeWidth={3}
                            className="ml-auto text-emerald-600"
                          />
                        )}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <Card padding="none">
          <div className="flex items-baseline justify-between border-b border-gray-100 px-4 py-3">
            <span className="font-display text-text-subtle text-[11px] tracking-wider uppercase">
              Workload
            </span>
            <span className="text-text-subtle text-xs">all openings</span>
          </div>
          {loads.length === 0 ? (
            <p className="text-text-subtle px-4 py-6 text-center text-sm">
              Pick who interviews on Recruitment team.
            </p>
          ) : (
            <ul className="flex max-h-[60vh] flex-col gap-2.5 overflow-y-auto px-4 py-3">
              {loads.map((l) => (
                <li key={l.nuid} className="flex flex-col gap-1 text-sm">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-ink truncate">{l.name}</span>
                    <span className="text-text-muted shrink-0 text-xs tabular-nums">
                      <span className="text-ink">{l.iv}</span>
                      {l.ivPlus > 0 && (
                        <span className="text-emerald-700"> +{l.ivPlus}</span>
                      )}
                      {withRecording && (
                        <>
                          {' · '}
                          <span className="text-ink">{l.rec}</span>
                          {l.recPlus > 0 && (
                            <span className="text-emerald-700">
                              {' '}
                              +{l.recPlus}
                            </span>
                          )}{' '}
                          rec
                        </>
                      )}
                    </span>
                  </span>
                  <span className="flex h-1.5 w-full bg-gray-100">
                    <span
                      className="bg-ink block h-full"
                      style={{ width: `${((l.iv + l.rec) / most) * 100}%` }}
                    />
                    <span
                      className="block h-full bg-emerald-400"
                      style={{
                        width: `${((l.ivPlus + l.recPlus) / most) * 100}%`,
                      }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={clearing}
        onOpenChange={setClearing}
        title={`Clear ${roleLabel(roleId)}?`}
        description={
          withRecording
            ? 'Interviewers and recording reviewers come off everyone whose interview isn’t done yet.'
            : 'Interviewers come off everyone whose interview isn’t done yet.'
        }
        confirmLabel="Clear"
        pending={m.clear.isPending}
        onConfirm={clear}
      />
    </div>
  )
}

export function interviewStatus(r: InterviewEntry) {
  if (r.done) return 'Interview done'
  if (r.started) return 'In progress'
  if (r.scheduledAt)
    return `Scheduled ${formatDeadline(new Date(r.scheduledAt))}`
  return 'Not scheduled'
}

type Team = { id: string; name: string; members: string[] }

function grouped<T>(items: T[], nuidOf: (x: T) => string, teams: Team[]) {
  const left = [...items]
  const groups: { team: Team; items: T[] }[] = []
  for (const team of teams) {
    const hit = team.members.map((m) => left.find((x) => nuidOf(x) === m))
    if (team.members.length > 1 && hit.every(Boolean)) {
      groups.push({ team, items: hit as T[] })
      for (const h of hit) left.splice(left.indexOf(h as T), 1)
    }
  }
  return { groups, rest: left }
}

function Chips({
  people,
  proposed,
  need,
  locked,
  canAdd,
  nameOf,
  options,
  panelOptions = [],
  teams = [],
  dayOf,
  label,
  onAdd,
  onRemove,
}: {
  panelOptions?: { value: string; label: string }[]
  teams?: Team[]
  dayOf?: (nuid: string) => string | undefined
  people: Person[]
  proposed: string[]
  need: number
  locked: boolean
  canAdd: boolean
  nameOf: (nuid: string) => string
  options: string[]
  label: string
  onAdd: (nuid: string) => void
  onRemove: (assignmentIds: string[]) => void
}) {
  const current = grouped(people, (x) => x.nuid, teams)
  const planned = grouped(proposed, (n) => n, teams)
  const chip = 'flex items-center gap-1 border px-2 py-0.5 text-xs'
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
      {current.groups.map(({ team, items }) => {
        const done = items.every((x) => x.done)
        return (
          <span
            key={team.id}
            title={items.map((x) => x.name).join(', ')}
            className={cn(chip, 'text-ink border-gray-300 bg-gray-50')}
          >
            <Users size={11} className="text-text-subtle" />
            {done && (
              <Check size={11} strokeWidth={3} className="text-emerald-600" />
            )}
            {team.name}
            {!done && !locked && (
              <button
                type="button"
                aria-label={`Remove ${team.name}`}
                onClick={() => onRemove(items.map((x) => x.assignmentId))}
                className="text-text-faint hover:text-ink -mr-0.5"
              >
                <X size={11} />
              </button>
            )}
          </span>
        )
      })}
      {current.rest.map((x) => (
        <span
          key={x.assignmentId}
          title={x.name}
          className={cn(chip, 'text-ink border-gray-200 bg-white')}
        >
          {x.done && (
            <Check size={11} strokeWidth={3} className="text-emerald-600" />
          )}
          {x.name.split(' ')[0]}
          {dayOf?.(x.nuid) && (
            <span className="text-text-subtle">· {dayOf(x.nuid)}</span>
          )}
          {!x.done && !locked && (
            <button
              type="button"
              aria-label={`Remove ${x.name}`}
              onClick={() => onRemove([x.assignmentId])}
              className="text-text-faint hover:text-ink -mr-0.5"
            >
              <X size={11} />
            </button>
          )}
        </span>
      ))}
      {planned.groups.map(({ team }) => (
        <span
          key={team.id}
          className={cn(
            chip,
            'border-dashed border-emerald-400 bg-emerald-50 text-emerald-800'
          )}
        >
          <Users size={11} /> + {team.name}
        </span>
      ))}
      {planned.rest.map((n) => (
        <span
          key={n}
          title={nameOf(n)}
          className={cn(
            chip,
            'border-dashed border-emerald-400 bg-emerald-50 text-emerald-800'
          )}
        >
          + {nameOf(n).split(' ')[0]}
        </span>
      ))}
      {canAdd && need > 0 && !locked && (
        <SearchableSelect
          key={people.length}
          variant="link"
          options={[
            ...panelOptions,
            ...options.map((n) => ({
              value: n,
              label: dayOf?.(n) ? `${nameOf(n)} · ${dayOf(n)}` : nameOf(n),
            })),
          ]}
          onValueChange={onAdd}
          placeholder="+ Add"
          searchPlaceholder="Search people"
          emptyText="No one else can take this"
          className="text-text-subtle hover:text-ink px-1 py-0.5 text-xs"
          ariaLabel={label}
        />
      )}
    </span>
  )
}

function DueLink({
  cycleId,
  roleId,
  field,
}: {
  cycleId: string
  roleId: string
  field: 'interview_closes_at' | 'interview_review_closes_at'
}) {
  const { data: pipeline } = usePipeline(cycleId)
  const { setDeadline: update } = usePipelineMutations(cycleId)
  const toast = useToast()
  const kind =
    field === 'interview_closes_at' ? 'interviewer' : 'recording_reviewer'
  const at = (k: 'interviewer' | 'recording_reviewer') => {
    const raw = dueAt(pipeline, 'interviews', roleId, k)
    return raw ? new Date(raw) : null
  }
  const due = at(kind) ?? undefined
  const interviews = at('interviewer')
  const recordings = at('recording_reviewer')
  function tooEarly(date: Date) {
    if (field === 'interview_review_closes_at')
      return !!interviews && date <= interviews
    return !!recordings && date >= recordings
  }
  return (
    <DateTimePicker
      value={due}
      disabled={update.isPending}
      onValueChange={(date) =>
        tooEarly(date)
          ? toast('Recording reviews have to be due after interviews.', {
              variant: 'error',
            })
          : update
              .mutateAsync({
                roleId,
                step: 'interviews',
                kind,
                dueAt: date.toISOString(),
              })
              .catch((err) => toast(apiErrorDetail(err), { variant: 'error' }))
      }
      trigger={
        <button
          type="button"
          className={cn(
            'text-xs underline decoration-dotted underline-offset-4',
            due
              ? 'text-ink hover:text-text-muted'
              : 'text-text-subtle hover:text-ink'
          )}
        >
          {due ? `Due ${formatDeadline(due)}` : 'Set due date'}
        </button>
      }
    />
  )
}

function PanelsButton({ cycleId }: { cycleId: string }) {
  const { data: panels = [] } = useInterviewPanels(cycleId)
  const { data: staffing } = useStaffing(cycleId)
  const { ivEach } = useInterviewSetup(cycleId)
  const { create, remove } = useInterviewPanelMutations(cycleId)
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<string[]>([])

  const team = [
    ...new Set(
      (staffing?.positions ?? []).flatMap((p) => p.interviewers ?? [])
    ),
  ]
  const { data: staff = [] } = useCycleStaff(cycleId)
  const nameOf = (nuid: string) =>
    staff.find((p) => p.user_nuid === nuid)?.full_name ?? nuid
  const inPanel = new Set(
    panels.flatMap((g) => (g.members ?? []).map((x) => x.user_nuid))
  )

  const free = team
    .filter((n) => !inPanel.has(n))
    .sort((a, b) => nameOf(a).localeCompare(nameOf(b)))
  const size = Math.max(2, ivEach)

  async function autoCreate() {
    const chunks: string[][] = []
    for (let i = 0; i < free.length; i += size)
      chunks.push(free.slice(i, i + size))
    const tail = chunks[chunks.length - 1]
    if (chunks.length > 1 && tail.length < 2) {
      chunks.pop()
      chunks[chunks.length - 1].push(...tail)
    }
    try {
      await create.mutateAsync(
        chunks.map((members) => ({
          name: members.map((n) => nameOf(n).split(' ')[0]).join(' & '),
          member_nuids: members,
        }))
      )
    } catch (err) {
      toast(apiErrorDetail(err), { variant: 'error' })
    }
  }

  async function add() {
    const name = picked.map((n) => nameOf(n).split(' ')[0]).join(' & ')
    try {
      await create.mutateAsync([{ name, member_nuids: picked }])
      setPicked([])
    } catch (err) {
      toast(apiErrorDetail(err), { variant: 'error' })
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Users /> Interview panels
        {panels.length > 0 && (
          <span className="text-text-muted tabular-nums">{panels.length}</span>
        )}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Interview panels</DialogTitle>
            <DialogDescription>
              People who interview together. With panels, auto-assign gives each
              applicant one whole panel. Panels of {ivEach} match your
              interviewers each.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            {panels.map((g) => (
              <div
                key={g.id}
                className="flex items-center justify-between gap-3 border border-gray-200 px-3 py-2 text-sm"
              >
                <span className="text-ink font-medium">{g.name}</span>
                <span className="flex items-center gap-2">
                  <span className="text-text-muted text-xs">
                    {(g.members ?? []).map((x) => x.full_name).join(', ')}
                  </span>
                  <button
                    type="button"
                    aria-label={`Delete ${g.name}`}
                    onClick={() =>
                      remove
                        .mutateAsync(g.id)
                        .catch((err) =>
                          toast(apiErrorDetail(err), { variant: 'error' })
                        )
                    }
                    className="text-text-faint hover:text-ink"
                  >
                    <X size={14} />
                  </button>
                </span>
              </div>
            ))}
          </div>
          {free.length >= 2 && (
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              disabled={create.isPending}
              onClick={autoCreate}
            >
              <Sparkles /> Auto-create panels of {size} from {free.length}{' '}
              people
            </Button>
          )}
          <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
            <span className="text-text-muted text-xs">
              Or pick people for a panel
            </span>
            <div className="flex flex-wrap gap-1.5">
              {team
                .filter((n) => !inPanel.has(n))
                .map((n) => {
                  const on = picked.includes(n)
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() =>
                        setPicked(
                          on ? picked.filter((x) => x !== n) : [...picked, n]
                        )
                      }
                      className={cn(
                        'border px-2.5 py-1 text-xs transition-colors',
                        on
                          ? 'border-ink bg-ink text-white'
                          : 'text-ink border-gray-200 hover:border-gray-400'
                      )}
                    >
                      {nameOf(n)}
                    </button>
                  )
                })}
            </div>
            <Button
              size="sm"
              className="w-fit"
              disabled={picked.length < 2 || create.isPending}
              onClick={add}
            >
              <Plus /> Add panel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ReleaseInterviews({
  cycleId,
  roleId,
  name,
  released,
  hasDue,
  assigned,
  withRecording,
}: {
  cycleId: string
  roleId: string
  name: string
  released: boolean
  hasDue: boolean
  assigned: boolean
  withRecording: boolean
}) {
  const { release: update } = usePipelineMutations(cycleId)
  const toast = useToast()
  const [confirm, setConfirm] = useState(false)

  if (released)
    return (
      <span className="flex items-center gap-2 text-sm">
        <span className="size-2 rounded-full bg-emerald-500" />
        <span className="text-ink">Interviews released</span>
      </span>
    )

  const blocked = !hasDue
    ? 'Set the interview due date first'
    : !assigned
      ? 'Assign interviewers first'
      : null

  async function release() {
    try {
      await update.mutateAsync({ roleId, step: 'interviews', released: true })
      setConfirm(false)
      toast(`Interviews released for ${name}`)
    } catch (err) {
      toast(apiErrorDetail(err), { variant: 'error' })
    }
  }

  return (
    <>
      {blocked ? (
        <Tooltip label={blocked}>
          <Button size="sm" disabled>
            Release interviews
          </Button>
        </Tooltip>
      ) : (
        <Button size="sm" onClick={() => setConfirm(true)}>
          Release interviews
        </Button>
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Release interviews for ${name}?`}
        description={
          withRecording
            ? 'Interviewers and recording reviewers can start. After this you can’t add, remove or swap anyone.'
            : 'Interviewers can start. After this you can’t add, remove or swap interviewers.'
        }
        confirmLabel="Release"
        pending={update.isPending}
        onConfirm={release}
      />
    </>
  )
}

function labelFor(slots: { id: string; label: string }[]) {
  return (id: string) => slots.find((s) => s.id === id)?.label ?? id
}
