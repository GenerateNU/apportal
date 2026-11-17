'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Check, ChevronRight, Lock, Video } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { DueLine } from '@/components/ui/due-line'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingText } from '@/components/ui/loading-text'
import { PageHeader } from '@/components/ui/page-header'
import { PAGE_SHELL } from '@/components/ui/page-shell'
import { SegmentedTabs } from '@/components/ui/segmented-tabs'
import { TABLE_FRAME, TABLE_ROW } from '@/components/ui/table-styles'
import type { ApplicationStage } from '@/lib/api/types'
import { useCycleScope } from '@/hooks/useCycleScope'
import {
  type InterviewEntry,
  useInterviewBoard,
} from '@/lib/queries/interview-board'
import { useCurrentUser } from '@/lib/queries/users'
import { cn } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'
import { apiErrorDetail } from '@/lib/api/client'
import {
  dueAt,
  released,
  stepConfig,
  useCycleSteps,
  useWorkflow,
  useWorkflowMutations,
} from '@/lib/queries/workflow'
import { queryKeys } from '@/lib/queries/keys'
import { ApplicationDetail } from '../../../applications/components/ApplicationDetail'
import { TASK_STATE } from '../../../my-work/useLeadWork'
import {
  interviewStatus,
  useInterviewSetup,
} from '../../interviewers/components/InterviewAssignClient'

type View = 'everyone' | 'mine'

function useDue(cycleId: string) {
  const { data: workflow } = useWorkflow(cycleId)
  return (
    roleId: string,
    field: 'interview_closes_at' | 'interview_review_closes_at'
  ) => {
    const raw = dueAt(
      workflow,
      'interviews',
      roleId,
      field === 'interview_closes_at' ? 'interviewer' : 'recording_reviewer'
    )
    return raw ? new Date(raw) : null
  }
}

function Progress({ done, total }: { done: number; total: number }) {
  return (
    <span className="block h-1.5 w-full bg-gray-100">
      <span
        className="bg-ink block h-full transition-[width]"
        style={{ width: `${total ? (done / total) * 100 : 0}%` }}
      />
    </span>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-display text-text-subtle text-[11px] tracking-wider uppercase">
      {children}
    </span>
  )
}

function Tally({
  label,
  done,
  total,
}: {
  label: string
  done: number
  total: number
}) {
  return (
    <div className="flex w-36 flex-col gap-1.5">
      <span className="flex items-baseline justify-between">
        <Label>{label}</Label>
        <span className="text-ink text-sm font-semibold tabular-nums">
          {done}
          <span className="text-text-subtle font-normal"> / {total}</span>
        </span>
      </span>
      <Progress done={done} total={total} />
    </div>
  )
}

export function InterviewingClient() {
  const scope = useCycleScope()
  const cycleId = scope.cycleId
  const { data: board, isLoading } = useInterviewBoard(cycleId, {
    history: true,
  })
  const { data: me } = useCurrentUser()
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const rows = board ?? []
  const myIv = rows.filter((r) =>
    r.interviewers.some((x) => x.nuid === me?.nuid)
  )
  const myRec = rows.filter((r) => r.reviewers.some((x) => x.nuid === me?.nuid))
  const mineDone =
    myIv.filter((r) => r.done).length +
    myRec.filter((r) => r.reviewers.find((x) => x.nuid === me?.nuid)?.done)
      .length
  const mineTotal = myIv.length + myRec.length
  const view: View =
    params.get('view') === 'mine' && mineTotal > 0 ? 'mine' : 'everyone'

  function setView(next: View) {
    const q = new URLSearchParams(params)
    if (next === 'mine') q.set('view', 'mine')
    else q.delete('view')
    router.replace(q.size ? `${pathname}?${q}` : pathname, { scroll: false })
  }

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        title="Interviews & progress"
        subtitle={
          view === 'mine'
            ? 'Open an interview to see the script, take notes and submit your rating.'
            : "Every interview by opening: who's scheduled, who's done and who's falling behind."
        }
        actions={
          mineTotal > 0 && (
            <div className="flex items-center gap-6">
              {view === 'mine' && (
                <Tally
                  label={mineDone === mineTotal ? 'All done' : 'Done'}
                  done={mineDone}
                  total={mineTotal}
                />
              )}
              <SegmentedTabs
                tabs={[
                  { id: 'everyone', label: 'Everyone' },
                  {
                    id: 'mine',
                    label: 'My interviews',
                    count: mineTotal - mineDone,
                  },
                ]}
                value={view}
                onChange={setView}
              />
            </div>
          )
        }
      />
      {!cycleId ? (
        scope.isLoading ? (
          <LoadingText />
        ) : (
          <EmptyState title="You're not a chief on any cycle yet" />
        )
      ) : isLoading || scope.roles.isLoading ? (
        <LoadingText />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No one is in interviews yet"
          description="Advance applicants on Shortlist, then assign interviewers."
          action={
            <Link
              href="/reviewer/cycle/cutoff"
              className="text-ink inline-flex items-center gap-1 text-sm font-medium hover:underline"
            >
              Go to Shortlist <ArrowRight size={14} />
            </Link>
          }
        />
      ) : view === 'mine' ? (
        <Mine
          cycleId={cycleId}
          me={me?.nuid ?? ''}
          interviews={myIv}
          recordings={myRec}
          roleIds={scope.roles.roleIds}
          roleLabel={scope.roles.roleLabel}
        />
      ) : (
        <Everyone
          cycleId={cycleId}
          rows={rows}
          roleIds={scope.roles.roleIds}
          roleLabel={scope.roles.roleLabel}
        />
      )}
    </div>
  )
}

function Mine({
  cycleId,
  me,
  interviews,
  recordings,
  roleIds,
  roleLabel,
}: {
  cycleId: string
  me: string
  interviews: InterviewEntry[]
  recordings: InterviewEntry[]
  roleIds: string[]
  roleLabel: (id: string) => string
}) {
  const due = useDue(cycleId)
  const [kind, setKind] = useState<'iv' | 'rec'>(
    interviews.length ? 'iv' : 'rec'
  )
  const sections = [
    ...roleIds.map((id) => ({
      kind: 'iv' as const,
      key: `iv-${id}`,
      title: roleLabel(id),
      date: due(id, 'interview_closes_at'),
      tasks: interviews
        .filter((r) => r.roleId === id)
        .map((r) => ({
          row: r,
          state: r.done ? 'done' : r.started ? 'draft' : 'todo',
          label: r.done
            ? 'Submitted'
            : r.started
              ? 'In progress'
              : r.scheduledAt
                ? interviewStatus(r)
                : 'To be interviewed',
        })),
    })),
    ...roleIds.map((id) => ({
      kind: 'rec' as const,
      key: `rec-${id}`,
      title: roleLabel(id),
      date: due(id, 'interview_review_closes_at'),
      tasks: recordings
        .filter((r) => r.roleId === id)
        .map((r) => {
          const done = !!r.reviewers.find((x) => x.nuid === me)?.done
          return {
            row: r,
            state: done ? 'done' : 'todo',
            label: done
              ? 'Submitted'
              : r.done
                ? 'To be reviewed'
                : 'Waiting on the interview',
          }
        }),
    })),
  ]
    .map((s) => ({
      ...s,
      tasks: [...s.tasks].sort(
        (a, b) => Number(a.state === 'done') - Number(b.state === 'done')
      ),
    }))
    .filter((s) => s.tasks.length > 0)
  const both = interviews.length > 0 && recordings.length > 0

  return (
    <div className="flex flex-col gap-8">
      {both && (
        <nav className="flex gap-6 border-b border-gray-200">
          {(
            [
              ['iv', 'Interviews'],
              ['rec', 'Recording reviews'],
            ] as const
          ).map(([id, label]) => {
            return (
              <button
                key={id}
                type="button"
                onClick={() => setKind(id)}
                className={cn(
                  '-mb-px border-b-2 py-3 text-sm font-medium transition-colors',
                  kind === id
                    ? 'border-ink text-ink'
                    : 'text-text-muted hover:text-ink border-transparent'
                )}
              >
                {label}
              </button>
            )
          })}
        </nav>
      )}
      {sections
        .filter((s) => !both || s.kind === kind)
        .map((s) => (
          <section key={s.key} className="flex flex-col gap-4">
            <div className="flex items-end justify-between gap-4">
              <div className="flex flex-col gap-1.5">
                <h2 className="font-display text-ink text-xl font-bold tracking-tight uppercase">
                  {s.title}
                  {s.kind === 'rec' && !both && ' · recording reviews'}
                </h2>
                {s.date && (
                  <DueLine
                    date={s.date}
                    label={
                      s.kind === 'rec'
                        ? 'Recording reviews due'
                        : 'Interviews due'
                    }
                    icon={s.kind === 'rec' ? Video : undefined}
                  />
                )}
              </div>
              <Label>
                {s.tasks.filter((t) => t.state === 'done').length} of{' '}
                {s.tasks.length} done
              </Label>
            </div>
            <div className={TABLE_FRAME}>
              {s.tasks.map(({ row, state, label }) => (
                <Link
                  key={row.applicationId}
                  href={`/reviewer/my-interviews/${row.applicationId}`}
                  className={cn(
                    'group flex flex-wrap items-center gap-x-6 gap-y-2',
                    TABLE_ROW
                  )}
                >
                  <span className="text-ink min-w-0 flex-1 truncate font-semibold">
                    {row.name}
                  </span>
                  <Badge
                    className={
                      TASK_STATE[state as 'done' | 'draft' | 'todo'].className
                    }
                  >
                    {label}
                  </Badge>
                  <span className="text-text-subtle group-hover:text-ink flex w-20 items-center justify-end gap-1 text-sm font-medium transition-colors">
                    {state === 'done' ? 'View' : 'Open'}
                    <ArrowRight
                      size={14}
                      className="transition-transform group-hover:translate-x-1"
                    />
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
    </div>
  )
}

type Tab =
  | 'interviewers'
  | 'reviewers'
  | 'unscheduled'
  | 'scheduled'
  | 'interviewed'
  | 'reviewed'

function Everyone({
  cycleId,
  rows,
  roleIds,
  roleLabel,
}: {
  cycleId: string
  rows: InterviewEntry[]
  roleIds: string[]
  roleLabel: (id: string) => string
}) {
  const { withRecording } = useInterviewSetup(cycleId)
  const due = useDue(cycleId)
  const { data: workflow } = useWorkflow(cycleId)
  const [picked, setPicked] = useState('')
  const [tab, setTab] = useState<Tab>('interviewers')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const withRows = roleIds.filter((id) => rows.some((r) => r.roleId === id))
  const roleId = withRows.includes(picked) ? picked : withRows[0]
  const inOpening = rows.filter((r) => r.roleId === roleId)
  const done = inOpening.filter((r) => r.done)
  const watched = (r: InterviewEntry) =>
    r.reviewers.length > 0 && r.reviewers.every((x) => x.done)
  const buckets: Record<
    Exclude<Tab, 'interviewers' | 'reviewers'>,
    InterviewEntry[]
  > = {
    unscheduled: inOpening.filter(
      (r) => !r.done && !r.scheduledAt && !r.started
    ),
    scheduled: inOpening.filter(
      (r) => !r.done && (!!r.scheduledAt || r.started)
    ),
    interviewed: inOpening.filter(
      (r) => r.done && !(withRecording && watched(r))
    ),
    reviewed: inOpening.filter((r) => r.done && watched(r)),
  }
  const empty: Record<keyof typeof buckets, string> = {
    unscheduled: 'Everyone has a time.',
    scheduled: 'No upcoming interviews.',
    interviewed: withRecording
      ? 'No interviews waiting on a review.'
      : 'No interviews done yet.',
    reviewed: 'No recordings reviewed yet.',
  }
  const recAll = inOpening.flatMap((r) => r.reviewers)
  const recDone = recAll.filter((x) => x.done).length

  const tallyOf = (kind: 'iv' | 'rec') => {
    const map = new Map<
      string,
      { name: string; items: { r: InterviewEntry; ok: boolean }[] }
    >()
    for (const r of inOpening)
      for (const x of kind === 'iv' ? r.interviewers : r.reviewers) {
        const p = map.get(x.nuid) ?? { name: x.name, items: [] }
        p.items.push({ r, ok: kind === 'iv' ? r.done : x.done })
        map.set(x.nuid, p)
      }
    return [...map.entries()]
      .map(([nuid, p]) => ({
        nuid,
        name: p.name,
        items: p.items,
        finished: p.items.filter((i) => i.ok).length,
        total: p.items.length,
      }))
      .sort(
        (a, b) =>
          a.finished / a.total - b.finished / b.total ||
          a.name.localeCompare(b.name)
      )
  }
  const interviewers = tallyOf('iv')
  const reviewers = tallyOf('rec')
  const list = tab === 'reviewers' ? reviewers : interviewers
  const opened = rows.find((r) => r.applicationId === open)
  const ivDue = roleId ? due(roleId, 'interview_closes_at') : null
  const recDue = roleId ? due(roleId, 'interview_review_closes_at') : null

  if (!roleId) return null

  const tabs = withRows.length > 1 && (
    <nav className="flex gap-6 overflow-x-auto border-b border-gray-200 px-5">
      {withRows.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => {
            setPicked(id)
            setExpanded(null)
          }}
          className={cn(
            '-mb-px shrink-0 border-b-2 py-3 text-sm font-medium transition-colors',
            id === roleId
              ? 'border-ink text-ink'
              : 'text-text-muted hover:text-ink border-transparent'
          )}
        >
          {roleLabel(id)}
        </button>
      ))}
    </nav>
  )

  if (!released(workflow, 'interviews', roleId)) {
    return (
      <Card padding="none">
        {tabs}
        <EmptyState
          className="py-12"
          title={`Interviews for ${roleLabel(roleId)} aren't out yet`}
          description="Release them and interviewers' progress shows up here."
          action={
            <Button variant="outline" asChild>
              <Link href="/reviewer/cycle/interviewers">
                Assign interviewers
              </Link>
            </Button>
          }
        />
      </Card>
    )
  }

  return (
    <>
      <Card padding="none">
        {tabs}

        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 py-4">
          <div className="flex flex-col gap-1">
            {ivDue ? (
              <DueLine date={ivDue} label="Interviews due" />
            ) : (
              <span className="text-text-subtle text-sm">
                No interview due date
              </span>
            )}
            {withRecording && recDue && (
              <DueLine
                date={recDue}
                label="Recording reviews due"
                icon={Video}
              />
            )}
          </div>
          <div className="flex gap-6">
            <Tally
              label="Interviews"
              done={done.length}
              total={inOpening.length}
            />
            {withRecording && (
              <Tally label="Reviews" done={recDone} total={recAll.length} />
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 border-y border-gray-100 px-4 py-2">
          {(
            [
              ['interviewers', 'Interviewers', interviewers.length],
              ...(withRecording
                ? ([['reviewers', 'Reviewers', reviewers.length]] as const)
                : []),
              ['unscheduled', 'Not scheduled', buckets.unscheduled.length],
              ['scheduled', 'Scheduled', buckets.scheduled.length],
              ['interviewed', 'Interviewed', buckets.interviewed.length],
              ...(withRecording
                ? ([['reviewed', 'Reviewed', buckets.reviewed.length]] as const)
                : []),
            ] as const
          ).map(([id, label, n]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'px-3 py-1 text-sm transition-colors',
                tab === id
                  ? 'bg-ink text-white'
                  : 'text-text-muted hover:text-ink hover:bg-gray-50'
              )}
            >
              {label}
              <span className="ml-1.5 tabular-nums opacity-70">{n}</span>
            </button>
          ))}
        </div>

        {tab === 'interviewers' || tab === 'reviewers' ? (
          list.length === 0 ? (
            <p className="text-text-subtle px-5 py-6 text-center text-sm">
              No one assigned yet.
            </p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              {list.map((p) => {
                const isOpen = expanded === p.nuid
                return (
                  <div
                    key={p.nuid}
                    className="border-b border-gray-100 last:border-b-0"
                  >
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setExpanded(isOpen ? null : p.nuid)}
                      className="flex w-full items-center gap-6 px-5 py-3 text-left transition-colors hover:bg-gray-50"
                    >
                      <span className="text-ink flex w-48 shrink-0 items-center gap-1.5 truncate text-sm font-medium">
                        <ChevronRight
                          size={14}
                          className={cn(
                            'text-text-subtle shrink-0 transition-transform',
                            isOpen && 'rotate-90'
                          )}
                        />
                        {p.name}
                      </span>
                      <span className="flex-1">
                        <Progress done={p.finished} total={p.total} />
                      </span>
                      <span className="text-text-muted w-28 shrink-0 text-right text-xs tabular-nums">
                        {p.finished}/{p.total}{' '}
                        {tab === 'reviewers' ? 'reviewed' : 'interviewed'}
                      </span>
                    </button>
                    {isOpen && (
                      <ul className="bg-gray-50 pb-2">
                        {[...p.items]
                          .sort((a, b) => Number(a.ok) - Number(b.ok))
                          .map(({ r, ok }) => (
                            <li key={r.applicationId}>
                              <button
                                type="button"
                                onClick={() => setOpen(r.applicationId)}
                                className="flex w-full items-center justify-between gap-4 py-1.5 pr-5 pl-12 text-left text-sm hover:bg-gray-100"
                              >
                                <span className="text-ink truncate">
                                  {r.name}
                                </span>
                                <span
                                  className={cn(
                                    'flex shrink-0 items-center gap-1 text-xs',
                                    ok ? 'text-emerald-600' : 'text-text-subtle'
                                  )}
                                >
                                  {ok && <Check size={12} strokeWidth={3} />}
                                  {tab === 'reviewers'
                                    ? ok
                                      ? 'Reviewed'
                                      : r.done
                                        ? 'Not reviewed'
                                        : 'Waiting on the interview'
                                    : interviewStatus(r)}
                                </span>
                              </button>
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          )
        ) : buckets[tab].length === 0 ? (
          <p className="text-text-subtle px-5 py-6 text-center text-sm">
            {empty[tab]}
          </p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            {buckets[tab].map((r) => (
              <button
                key={r.applicationId}
                type="button"
                onClick={() => setOpen(r.applicationId)}
                className="flex w-full items-center gap-4 border-b border-gray-100 px-5 py-2.5 text-left transition-colors last:border-b-0 hover:bg-gray-50"
              >
                <span className="text-ink w-48 shrink-0 truncate text-sm font-medium">
                  {r.name}
                </span>
                <span className="text-text-muted min-w-0 flex-1 truncate text-sm">
                  {r.interviewers.length
                    ? r.interviewers.map((x) => x.name.split(' ')[0]).join(', ')
                    : 'No interviewers yet'}
                </span>
                <span
                  className={cn(
                    'shrink-0 text-xs',
                    r.done ? 'text-emerald-600' : 'text-text-subtle'
                  )}
                >
                  {interviewStatus(r)}
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>

      <MoveOn cycleId={cycleId} rows={rows} withRecording={withRecording} />

      {opened && (
        <ApplicationDetail
          applicant={{
            id: opened.applicationId,
            nuid: opened.applicantNuid,
            fullName: opened.name,
            email: opened.email,
            role: opened.roleId,
            cycleId,
            stage: opened.stage as ApplicationStage,
            submittedAt: opened.submittedAt,
            returner: opened.returner,
          }}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  )
}

function MoveOn({
  cycleId,
  rows,
  withRecording,
}: {
  cycleId: string
  rows: InterviewEntry[]
  withRecording: boolean
}) {
  const { data: steps = [], isLoading: stepsLoading } = useCycleSteps(cycleId)
  const { advance } = useWorkflowMutations(cycleId)
  const queryClient = useQueryClient()
  const toast = useToast()
  const [confirm, setConfirm] = useState(false)

  const next = !!stepConfig(steps, 'decisions')?.enabled
  const interviewed = rows.filter((r) => r.done).length
  const reviews = rows.flatMap((r) => r.reviewers)
  const reviewed = reviews.filter((x) => x.done).length
  const needsReviewer = withRecording
    ? rows.filter((r) => r.reviewers.length === 0).length
    : 0
  const ready =
    rows.length > 0 &&
    interviewed === rows.length &&
    (!withRecording || (needsReviewer === 0 && reviewed === reviews.length))

  async function go() {
    try {
      const byRole = new Map<string, string[]>()
      for (const r of rows)
        byRole.set(r.roleId, [...(byRole.get(r.roleId) ?? []), r.applicationId])
      for (const [roleId, applicationIds] of byRole)
        await advance.mutateAsync({
          step: 'interviews',
          roleId,
          applicationIds,
        })
      await queryClient.invalidateQueries({
        queryKey: queryKeys.interviewBoard.all,
      })
      setConfirm(false)
      toast(
        next
          ? `Moved ${rows.length} to Decisions. Interviews are done.`
          : 'Interviews are done.'
      )
    } catch (err) {
      toast(apiErrorDetail(err), { variant: 'error' })
    }
  }

  if (rows.length === 0 || stepsLoading) return null

  if (!ready)
    return (
      <p className="text-text-muted flex items-center gap-2 text-sm">
        <Lock size={14} className="shrink-0" />
        {next ? 'Decisions' : 'Finishing interviews'} unlocks once every
        interview{withRecording ? ' and recording review' : ''} is in:{' '}
        {interviewed}/{rows.length} interviewed
        {withRecording &&
          ` · ${reviewed}/${reviews.length} reviewed${needsReviewer ? ` · ${needsReviewer} without a reviewer` : ''}`}
      </p>
    )

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-ink flex items-center gap-2 text-sm">
        <Check size={14} className="text-emerald-600" />
        Every interview{withRecording ? ' and recording review' : ''} is in.
      </span>
      <Button variant="brutal-ink" onClick={() => setConfirm(true)}>
        {next ? (
          <>
            Move {rows.length} to Decisions <ArrowRight />
          </>
        ) : (
          'Finish interviews'
        )}
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={
          next ? `Move ${rows.length} to Decisions?` : 'Finish interviews?'
        }
        description={
          next
            ? 'Everyone interviewed, across every opening, moves to Decisions.'
            : 'The interview stage is marked done.'
        }
        confirmLabel={next ? 'Move' : 'Finish'}
        pending={advance.isPending}
        onConfirm={go}
      />
    </Card>
  )
}
