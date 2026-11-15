'use client'

import { useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { getDraftBoard } from '@/generated/draft/draft'
import type { DraftBoard } from '@/lib/api/types'
import { queryKeys } from '@/lib/queries/keys'
import { redirect, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Check, Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { TABLE_FRAME, TABLE_ROW } from '@/components/ui/table-styles'
import { useApplications } from '@/lib/queries/applications'
import { useBranches } from '@/lib/queries/branches'
import { useMyCycles } from '@/lib/queries/cycle-staff'
import { useCycles } from '@/lib/queries/cycles'
import { useDecisions } from '@/lib/queries/decisions'
import { useInterviewReviewersBulk } from '@/lib/queries/interview-assignments'
import {
  interviewSubmitted,
  useInterviewsByApplicationIds,
} from '@/lib/queries/interviews'
import {
  usePreferenceListDeadlines,
  usePreferenceListDetails,
  usePreferenceLists,
} from '@/lib/queries/preference-lists'
import { useCycleRoles, useRoleLookup } from '@/lib/queries/roles'
import { useCurrentUser } from '@/lib/queries/users'
import { useWrittenReviewsByApplicationIds } from '@/lib/queries/written-reviews'
import {
  PREFERENCE_LIST_STATUS_BADGE,
  PREFERENCE_LIST_STATUS_LABEL,
} from '@/lib/preference-list-status'
import { cn, formatDate } from '@/lib/utils'
import { PAGE_TOP, PAGE_X } from '@/components/ui/page-shell'
import { feedbackState } from '../decisions/components/constants'

type Task = {
  id: string
  title: string
  roleId?: string
  meta?: string
  status: { label: string; className?: string }
  done: boolean
  waiting?: boolean
  href: string
  action: string
}

type Phase = {
  id:
    | 'reviews'
    | 'interviews'
    | 'interviewReviews'
    | 'preference'
    | 'draft'
    | 'feedback'
  label: string
  blurb: string
  grouped: boolean
  sections?: { title: string; aside?: string; tasks: Task[] }[]
  deadline?: string
  open: boolean
  tasks: Task[]
  locked: string
  done: boolean
}

const ENABLED_PHASES = new Set<Phase['id']>([
  'reviews',
  'interviews',
  'interviewReviews',
  'preference',
  'draft',
  'feedback',
])

const NOUNS: Record<Phase['id'], [string, string]> = {
  reviews: ['review', 'reviews'],
  interviews: ['interview', 'interviews'],
  interviewReviews: ['interview review', 'interview reviews'],
  preference: ['preference list', 'preference lists'],
  draft: ['draft', 'drafts'],
  feedback: ['feedback note', 'feedback notes'],
}

const STATE = {
  todo: { label: 'To do', className: 'bg-gray-100 text-ink' },
  draft: { label: 'In progress', className: 'bg-chip-9-bg text-chip-9-text' },
  done: { label: 'Submitted', className: 'bg-status-open/15 text-status-open' },
  waiting: { label: 'Waiting', className: 'bg-gray-100 text-text-subtle' },
}

function useLeadCycle() {
  const { data: mine = [], isLoading } = useMyCycles()
  const { data: cycles = [] } = useCycles({})
  const { data: branches = [] } = useBranches()
  const staffed = mine
    .map((m) => cycles.find((c) => c.id === m.cycle_id))
    .filter((c) => !!c)
  const cycle = staffed.find((c) => c.status === 'open') ?? staffed[0]
  const branch = branches.find((b) => b.id === cycle?.branch_id)
  return { cycle, branch, isLoading }
}

export function LeadHomeClient() {
  const { data: user } = useCurrentUser()
  const me = user?.nuid ?? ''
  const { cycle, branch, isLoading } = useLeadCycle()
  const cycleId = cycle?.id ?? ''
  const ready = !!me && !!cycleId
  const { roleLabel } = useRoleLookup()

  const { data: reviewApps = [], isPending: reviewAppsPending } =
    useApplications({ assigned_to: me, cycle_id: cycleId }, undefined, {
      enabled: ready,
    })
  const { data: interviewApps = [] } = useApplications(
    { interviewer_nuid: me, cycle_id: cycleId },
    undefined,
    { enabled: ready }
  )
  const { data: recordingApps = [] } = useApplications(
    { recording_reviewer_nuid: me, cycle_id: cycleId },
    undefined,
    { enabled: ready }
  )

  const reviewIds = useMemo(() => reviewApps.map((a) => a.id), [reviewApps])
  const interviewIds = useMemo(
    () => [...new Set([...interviewApps, ...recordingApps].map((a) => a.id))],
    [interviewApps, recordingApps]
  )
  const recordingIds = useMemo(
    () => recordingApps.map((a) => a.id),
    [recordingApps]
  )
  const writtenReviews = useWrittenReviewsByApplicationIds(reviewIds)
  const { data: interviews = {} } = useInterviewsByApplicationIds(interviewIds)
  const { data: recordingReviewers = {} } =
    useInterviewReviewersBulk(recordingIds)

  const { data: lists = [] } = usePreferenceLists(cycleId)
  const { data: listDetails = [] } = usePreferenceListDetails(cycleId)
  const { roleIds } = useCycleRoles(cycleId)
  const deadlines = usePreferenceListDeadlines(cycleId, roleIds)
  const { data: decisions = [] } = useDecisions(cycleId)
  const boards = useQueries({
    queries: roleIds.map((roleId) => ({
      queryKey: queryKeys.drafts.board(cycleId, roleId),
      queryFn: () =>
        getDraftBoard(cycleId, { role_id: roleId }) as Promise<DraftBoard>,
      enabled: !!cycleId,
      retry: false,
    })),
    combine: (results) =>
      results.map((q) => q.data).filter((b): b is DraftBoard => !!b),
  })

  const phases: Phase[] = useMemo(() => {
    const reviewTasks: Task[] = reviewApps.map((app, i) => {
      const mineReview = writtenReviews[i]?.data?.find(
        (r) => r.reviewer_nuid === me
      )
      const state = mineReview?.submitted_at
        ? 'done'
        : mineReview
          ? 'draft'
          : 'todo'
      return {
        id: app.id,
        title: app.full_name,
        roleId: app.role_id,
        status:
          state === 'todo'
            ? { ...STATE.todo, label: 'To be reviewed' }
            : STATE[state],
        done: state === 'done',
        href: `/reviewer/my-reviews/${app.id}`,
        action: state === 'done' ? 'View' : 'Review',
      }
    })

    const interviewTasks: Task[] = interviewApps.map((app) => {
      const interview = interviews[app.id]
      const state = interviewSubmitted(interview)
        ? 'done'
        : interview?.writeup
          ? 'draft'
          : 'todo'
      return {
        id: `iv-${app.id}`,
        title: app.full_name,
        roleId: app.role_id,
        meta: interview?.scheduled_at
          ? `Interview · ${formatDate(interview.scheduled_at)}`
          : 'Interview · not scheduled',
        status:
          state === 'todo'
            ? { ...STATE.todo, label: 'To be interviewed' }
            : STATE[state],
        done: state === 'done',
        href: `/reviewer/my-interviews/${app.id}`,
        action: state === 'done' ? 'View' : 'Open',
      }
    })

    const recordingTasks: Task[] = recordingApps.map((app) => {
      const mineReview = recordingReviewers[app.id]?.find(
        (r) => r.reviewer_nuid === me
      )
      const waiting = !interviewSubmitted(interviews[app.id])
      const state = mineReview?.writeup_submitted_at
        ? 'done'
        : waiting
          ? 'waiting'
          : mineReview?.writeup
            ? 'draft'
            : 'todo'
      return {
        id: `rr-${app.id}`,
        title: app.full_name,
        roleId: app.role_id,
        meta: waiting ? 'Waiting on the interviewer to submit' : undefined,
        status:
          state === 'todo'
            ? { ...STATE.todo, label: 'To be reviewed' }
            : STATE[state],
        done: state === 'done',
        waiting: state === 'waiting',
        href: `/reviewer/my-interviews/${app.id}`,
        action: state === 'done' ? 'View' : 'Open',
      }
    })

    const myListIds = new Set(lists.map((l) => l.id))
    const listTasks: Task[] = lists.map((list) => {
      const entries = listDetails.find((d) => d.id === list.id)?.entries ?? []
      const submitted = list.status === 'submitted'
      const perRole = roleIds
        .map(
          (roleId) =>
            `${roleLabel(roleId)} ${entries.filter((e) => e.role_id === roleId).length}`
        )
        .join(' · ')
      return {
        id: list.id,
        title: list.name,
        meta: perRole ? `Ranked so far: ${perRole}` : undefined,
        status: {
          label: PREFERENCE_LIST_STATUS_LABEL[list.status],
          className: PREFERENCE_LIST_STATUS_BADGE[list.status],
        },
        done: submitted,
        href: `/reviewer/preference-lists/${list.id}`,
        action: submitted ? 'View' : 'Rank',
      }
    })
    const team = lists.length === 1 ? lists[0] : undefined
    const listDeadline = Object.values(deadlines).find(Boolean)

    const settingUp = boards.some((b) => b.status === 'setup')
    const startedBoards = boards.filter((b) => b.status !== 'setup')
    const roleStatus = startedBoards.map((board) => {
      const teams = board.teams ?? []
      const mine = teams.find((t) => myListIds.has(t.preference_list_id))
      const onClock = teams.find((t) => t.id === board.on_the_clock_team_id)
      const label = roleLabel(board.role_id)
      if (board.status === 'complete') return `${label} finished`
      return onClock && onClock.id === mine?.id
        ? `${label}: your team is on the clock`
        : `${label}: ${onClock?.name ?? 'next team'} is picking`
    })
    const anyLive = startedBoards.some((b) => b.status === 'active')
    const allDone =
      startedBoards.length > 0 &&
      startedBoards.every((b) => b.status === 'complete') &&
      !settingUp
    const draftTasks: Task[] =
      startedBoards.length === 0
        ? []
        : [
            {
              id: 'draft',
              title: 'Draft',
              meta: roleStatus.join(' · '),
              status: allDone
                ? { label: 'Finished', className: STATE.done.className }
                : anyLive
                  ? { label: 'Live', className: STATE.done.className }
                  : STATE.waiting,
              done: allDone,
              href: '/reviewer/my-work/draft',
              action: allDone ? 'View' : 'Watch',
            },
          ]

    const feedbackTasks: Task[] = decisions
      .filter(
        (row) =>
          row.stage === 'rejected' &&
          row.kind === 'rejection_post_interview' &&
          (row.interviewers ?? []).some((i) => i.nuid === me)
      )
      .map((row) => {
        const state = feedbackState(row)
        return {
          id: row.application_id,
          title: row.full_name,
          roleId: row.role_id,
          status:
            row.status === 'sent'
              ? { ...STATE.done, label: 'Sent' }
              : state === 'submitted'
                ? { ...STATE.done, label: 'Written' }
                : state === 'draft'
                  ? STATE.draft
                  : { ...STATE.todo, label: 'To be written' },
          done: state === 'submitted',
          href: `/reviewer/decisions/${row.application_id}`,
          action: state === 'submitted' ? 'View' : 'Write',
        }
      })

    const make = (
      id: Phase['id'],
      label: string,
      tasks: Task[],
      open: boolean,
      locked: string,
      blurb: string,
      deadline?: string,
      grouped = true,
      sections?: Phase['sections']
    ): Phase => {
      const enabled = ENABLED_PHASES.has(id)
      const isOpen = enabled && open
      return {
        id,
        label,
        tasks,
        blurb,
        deadline,
        grouped,
        sections,
        open: isOpen,
        locked: enabled ? locked : 'Opens once your chiefs move the cycle on.',
        done: isOpen && tasks.length > 0 && tasks.every((t) => t.done),
      }
    }

    return [
      make(
        'reviews',
        'Reviews',
        reviewTasks,
        reviewTasks.length > 0,
        'Opens once your chief assigns you applications to review.',
        'Read each application and score it.'
      ),
      make(
        'interviews',
        'Interviews',
        interviewTasks,
        interviewTasks.length > 0,
        'Opens once your chief assigns you interviews.',
        'Interview each applicant, then submit the recording, notes, write-up and rating.'
      ),
      make(
        'interviewReviews',
        'Interview reviews',
        recordingTasks,
        recordingTasks.length > 0,
        'Opens once your chief assigns you interview recordings to review.',
        'Watch each recording and add your review.'
      ),
      make(
        'preference',
        'Preference list',
        listTasks,
        listTasks.length > 0 || !!listDeadline,
        'Opens once your chief sets a preference-list deadline.',
        team
          ? `Rank the applicants ${team.name} wants for every role, then submit the whole list together. Your team: ${(team.member_names ?? []).join(', ')}.`
          : 'Rank the applicants your team wants for every role, then submit the whole list together.',
        listDeadline ?? undefined,
        false,
        [{ title: 'Your team', tasks: listTasks }]
      ),
      make(
        'draft',
        'Draft',
        draftTasks,
        draftTasks.length > 0,
        settingUp
          ? 'Chiefs are setting up the draft. It opens here once they start it.'
          : 'Opens once a chief starts the draft.',
        'Teams take turns picking. Follow along and see who is left on your list.',
        undefined,
        false
      ),
      make(
        'feedback',
        'Feedback',
        feedbackTasks,
        feedbackTasks.length > 0,
        'Opens once applicants you interviewed reach a decision.',
        'Write feedback for the applicants you interviewed.'
      ),
    ]
  }, [
    reviewApps,
    writtenReviews,
    interviewApps,
    recordingApps,
    interviews,
    recordingReviewers,
    lists,
    listDetails,
    roleIds,
    deadlines,
    decisions,
    boards,
    roleLabel,
    me,
  ])

  const current =
    phases.find((p) => p.open && !p.done) ??
    [...phases].reverse().find((p) => p.open)
  const waiting = current
    ? current.tasks.filter((t) => !t.done && !t.waiting).length
    : 0
  const nextLocked = phases.find((p) => !p.open)
  const summary = !phases.some((p) => p.open)
    ? 'Nothing assigned to you yet.'
    : current && !current.done && waiting > 0
      ? `${waiting} ${NOUNS[current.id][waiting === 1 ? 0 : 1]} waiting on you`
      : nextLocked
        ? `You're all caught up. ${nextLocked.locked}`
        : 'All done for this cycle. Thank you!'
  const requestedPhase = useSearchParams().get('phase')
  const [picked, setPicked] = useState(requestedPhase)
  const selected =
    phases.find((p) => p.id === picked && p.open) ?? current ?? phases[0]

  const loadingWork =
    isLoading ||
    (!!cycle &&
      (!me || reviewAppsPending || writtenReviews.some((q) => q.isPending)))
  if (loadingWork) return <LeadHomeSkeleton />

  if (!cycle) redirect('/applicant/applications')

  return (
    <LeadPage>
      <PageHeader
        back={<Breadcrumbs items={[{ label: 'My work' }]} />}
        title="My work"
        subtitle={`${[branch?.name, cycle?.name].filter(Boolean).join(' · ')} · ${summary}`}
      />

      <nav aria-label="Phases" className="-mx-1 overflow-x-auto">
        <ol className="flex min-w-max items-center gap-1 px-1">
          {phases.map((phase, i) => {
            const total = phase.tasks.length
            const doneCount = phase.tasks.filter((t) => t.done).length
            const isSelected = selected?.id === phase.id
            const isCurrent = phase.id === current?.id
            return (
              <li key={phase.id} className="flex items-center gap-1">
                {i > 0 && (
                  <span
                    aria-hidden
                    className={cn(
                      'h-px w-4 sm:w-8',
                      phase.open ? 'bg-ink/40' : 'bg-gray-200'
                    )}
                  />
                )}
                <button
                  type="button"
                  onClick={() => setPicked(phase.id)}
                  disabled={!phase.open}
                  title={phase.open ? undefined : phase.locked}
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-pressed={isSelected}
                  className={cn(
                    'font-display flex items-center gap-2 border px-3 py-2 text-xs tracking-wider uppercase transition-colors',
                    isSelected
                      ? 'border-ink bg-ink text-white'
                      : 'text-ink border-gray-200 bg-white hover:border-gray-400',
                    !phase.open &&
                      'text-text-subtle cursor-not-allowed border-dashed opacity-50 hover:border-gray-200'
                  )}
                >
                  {isCurrent && !phase.done ? (
                    <span className="relative flex size-2">
                      <span className="bg-status-open absolute inline-flex size-full animate-ping rounded-full opacity-60" />
                      <span className="bg-status-open relative inline-flex size-2 rounded-full" />
                      <span className="sr-only">Current phase</span>
                    </span>
                  ) : phase.done ? (
                    <Check size={12} strokeWidth={3} />
                  ) : !phase.open ? (
                    <Lock size={11} />
                  ) : null}
                  <span className="font-bold">{phase.label}</span>
                  {phase.open && total > 0 && !phase.done && (
                    <span className="opacity-60">
                      {doneCount}/{total}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      {selected && renderPhasePanel(selected)}
    </LeadPage>
  )

  function renderPhasePanel(phase: Phase) {
    if (!phase.open) {
      return <EmptyState title="Not open yet" description={phase.locked} />
    }
    const total = phase.tasks.length
    const doneCount = phase.tasks.filter((t) => t.done).length
    const next = phase.tasks.find((t) => !t.done && !t.waiting)
    const header = (
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border border-gray-200 bg-white p-5">
        <div className="flex max-w-xl min-w-0 flex-col gap-1">
          <h2 className="font-display text-ink text-xl font-bold tracking-tight uppercase">
            {phase.label}
          </h2>
          <p className="text-text-muted text-sm">{phase.blurb}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {phase.deadline && (
            <div className="flex flex-col">
              <span className="font-display text-text-subtle text-[11px] tracking-wider uppercase">
                Due
              </span>
              <span className="text-ink text-sm font-semibold">
                {formatDate(phase.deadline)}
              </span>
            </div>
          )}
          {total === 1 && (
            <div className="flex flex-col">
              <span className="font-display text-text-subtle text-[11px] tracking-wider uppercase">
                Status
              </span>
              <span className="text-ink text-sm font-semibold">
                {phase.tasks[0].status.label}
              </span>
            </div>
          )}
          {total > 1 && (
            <div className="flex w-40 flex-col gap-1.5">
              <span className="font-display text-text-subtle text-[11px] tracking-wider uppercase">
                {phase.done ? 'All done' : `${doneCount} of ${total} done`}
              </span>
              <span className="block h-1 w-full bg-gray-200">
                <span
                  className="bg-ink block h-full transition-[width]"
                  style={{ width: `${(doneCount / total) * 100}%` }}
                />
              </span>
            </div>
          )}
          {next && (
            <Link
              href={next.href}
              className="bg-ink inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white"
            >
              {next.action === 'Watch' ? 'Watch' : 'Continue'}
              <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </div>
    )
    const groups = new Map<string, Task[]>()
    for (const task of phase.tasks) {
      const key = phase.grouped ? (task.roleId ?? '') : ''
      groups.set(key, [...(groups.get(key) ?? []), task])
    }
    const rank = (id: string) => {
      const i = roleIds.indexOf(id)
      return i === -1 ? roleIds.length : i
    }
    const sections = phase.sections
      ? phase.sections.map((sec) => ({
          key: sec.title,
          title: sec.title as string | null,
          aside: sec.aside,
          tasks: sec.tasks,
        }))
      : [...groups.entries()]
          .sort(([a], [b]) => rank(a) - rank(b))
          .map(([roleId, tasks]) => ({
            key: roleId,
            title: phase.grouped
              ? roleId
                ? roleLabel(roleId)
                : 'Other'
              : null,
            aside: `${tasks.filter((t) => t.done).length} of ${tasks.length} done`,
            tasks,
          }))
    return (
      <div className="flex flex-col gap-10">
        {header}
        {sections.map(({ key, title, aside, tasks }) => {
          const ordered = [...tasks].sort(
            (a, b) => Number(a.done) - Number(b.done)
          )
          return (
            <section key={key} className="flex flex-col gap-4">
              {title && (
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="font-display text-ink text-xl font-bold tracking-tight uppercase">
                    {title}
                  </h2>
                  {aside && (
                    <span className="font-display text-text-subtle text-[11px] tracking-wider uppercase">
                      {aside}
                    </span>
                  )}
                </div>
              )}
              <div className={TABLE_FRAME}>
                {ordered.map((task) => (
                  <Link
                    key={task.id}
                    href={task.href}
                    className={cn(
                      'group flex flex-wrap items-center gap-x-6 gap-y-2',
                      TABLE_ROW,
                      task.waiting && 'opacity-60'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-ink block truncate font-semibold">
                        {task.title}
                      </span>
                      {task.meta && (
                        <p className="text-text-muted mt-0.5 text-xs">
                          {task.meta}
                        </p>
                      )}
                    </div>
                    <Badge className={task.status.className}>
                      {task.status.label}
                    </Badge>
                    <span className="text-text-subtle group-hover:text-ink flex w-20 items-center justify-end gap-1 text-sm font-medium transition-colors">
                      {task.action}
                      <ArrowRight
                        size={14}
                        className="transition-transform group-hover:translate-x-1"
                      />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    )
  }
}

function LeadHomeSkeleton() {
  return (
    <LeadPage>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className="h-8 w-28 animate-pulse bg-gray-100" />
        ))}
      </div>
      <div className="h-24 animate-pulse border border-gray-100 bg-gray-50" />
      <div className={TABLE_FRAME}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={cn('flex items-center gap-6', TABLE_ROW)}>
            <div className="flex flex-1 flex-col gap-1.5">
              <span className="h-4 w-40 animate-pulse bg-gray-100" />
              <span className="h-3 w-24 animate-pulse bg-gray-100" />
            </div>
            <span className="h-5 w-20 animate-pulse bg-gray-100" />
            <span className="h-4 w-16 animate-pulse bg-gray-100" />
          </div>
        ))}
      </div>
    </LeadPage>
  )
}

function LeadPage({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn('flex w-full flex-col gap-8 pb-12', PAGE_X, PAGE_TOP)}>
      {children}
    </div>
  )
}
