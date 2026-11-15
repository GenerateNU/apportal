'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Check, Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
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
  id: 'reviews' | 'interviews' | 'interviewReviews' | 'preference' | 'feedback'
  label: string
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
])

const NOUNS: Record<Phase['id'], [string, string]> = {
  reviews: ['review', 'reviews'],
  interviews: ['interview', 'interviews'],
  interviewReviews: ['interview review', 'interview reviews'],
  preference: ['preference list', 'preference lists'],
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
  const { roleIds } = useCycleRoles(cycleId)
  const deadlines = usePreferenceListDeadlines(cycleId, roleIds)
  const { data: decisions = [] } = useDecisions(cycleId)

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

    const listTasks: Task[] = lists.map((list) => ({
      id: list.id,
      title: list.name,
      meta: `${list.entry_count} ranked · ${list.member_count} members`,
      status: {
        label: PREFERENCE_LIST_STATUS_LABEL[list.status],
        className: PREFERENCE_LIST_STATUS_BADGE[list.status],
      },
      done: list.status === 'submitted',
      href: `/reviewer/preference-lists/${list.id}`,
      action: list.status === 'submitted' ? 'View' : 'Rank',
    }))
    const listDeadline = Object.values(deadlines).find(Boolean)

    const feedbackTasks: Task[] = decisions.map((row) => {
      const state = feedbackState(row)
      return {
        id: row.application_id,
        title: row.full_name,
        roleId: row.role_id,
        status:
          state === 'submitted'
            ? STATE.done
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
      locked: string
    ): Phase => {
      const enabled = ENABLED_PHASES.has(id)
      const isOpen = enabled && open
      return {
        id,
        label,
        tasks,
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
        'Opens once your chief assigns you applications to review.'
      ),
      make(
        'interviews',
        'Interviews',
        interviewTasks,
        interviewTasks.length > 0,
        'Opens once your chief assigns you interviews.'
      ),
      make(
        'interviewReviews',
        'Interview reviews',
        recordingTasks,
        recordingTasks.length > 0,
        'Opens once your chief assigns you interview recordings to review.'
      ),
      make(
        'preference',
        'Preference list',
        listTasks,
        listTasks.length > 0 || !!listDeadline,
        'Opens once your chief sets a preference-list deadline.'
      ),
      make(
        'feedback',
        'Feedback',
        feedbackTasks,
        feedbackTasks.length > 0,
        'Opens once applicants you interviewed reach a decision.'
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
    deadlines,
    decisions,
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
        : 'All done for this cycle.'
  const requestedPhase = useSearchParams().get('phase')
  const [picked, setPicked] = useState(requestedPhase)
  const selected =
    phases.find((p) => p.id === picked && p.open) ?? current ?? phases[0]

  const loadingWork =
    isLoading ||
    (!!cycle &&
      (!me || reviewAppsPending || writtenReviews.some((q) => q.isPending)))
  if (loadingWork) return <LeadHomeSkeleton />

  if (!cycle) {
    return (
      <LeadPage>
        <PageHeader
          back={<Breadcrumbs items={[{ label: 'My work' }]} />}
          title="My work"
        />
        <EmptyState
          title="You're not on a cycle's team yet"
          description="Once a chief adds you to a cycle, your reviews and interviews show up here."
        />
      </LeadPage>
    )
  }

  return (
    <LeadPage>
      <PageHeader
        back={<Breadcrumbs items={[{ label: 'My work' }]} />}
        title="My work"
        subtitle={`${[branch?.name, cycle?.name].filter(Boolean).join(' · ')} · ${summary}`}
      />

      <ol className="grid grid-cols-2 border border-gray-200 bg-white sm:grid-cols-5">
        {phases.map((phase) => {
          const total = phase.tasks.length
          const doneCount = phase.tasks.filter((t) => t.done).length
          const isSelected = selected?.id === phase.id
          const isCurrent = phase.id === current?.id
          return (
            <li
              key={phase.id}
              className="border-gray-200 not-last:border-b sm:not-last:border-r sm:not-last:border-b-0"
            >
              <button
                type="button"
                onClick={() => setPicked(phase.id)}
                disabled={!phase.open}
                title={phase.open ? undefined : phase.locked}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors',
                  isSelected ? 'bg-ink text-white' : 'hover:bg-gray-50',
                  !phase.open &&
                    'text-text-subtle cursor-not-allowed opacity-40 hover:bg-transparent'
                )}
              >
                <span className="font-display flex items-center gap-1.5 text-sm font-bold tracking-wider uppercase">
                  {isCurrent && (
                    <span className="relative flex size-2">
                      <span className="bg-status-open absolute inline-flex size-full animate-ping rounded-full opacity-60" />
                      <span className="bg-status-open relative inline-flex size-2 rounded-full" />
                      <span className="sr-only">Current phase</span>
                    </span>
                  )}
                  {phase.label}
                  {phase.done && <Check size={13} strokeWidth={3} />}
                  {!phase.open && <Lock size={12} />}
                </span>
                <span className="text-xs opacity-70">
                  {!phase.open
                    ? 'Not open yet'
                    : phase.done
                      ? `All done · ${total} of ${total}`
                      : `${doneCount} of ${total} done`}
                </span>
                {phase.open && total > 0 && (
                  <span
                    className={cn(
                      'mt-1 block h-1 w-full',
                      isSelected ? 'bg-white/25' : 'bg-gray-200'
                    )}
                  >
                    <span
                      className={cn(
                        'block h-full transition-[width]',
                        isSelected ? 'bg-white' : 'bg-ink'
                      )}
                      style={{ width: `${(doneCount / total) * 100}%` }}
                    />
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ol>

      {selected && <PhasePanel phase={selected} />}
    </LeadPage>
  )

  function PhasePanel({ phase }: { phase: Phase }) {
    if (!phase.open) {
      return <EmptyState title="Not open yet" description={phase.locked} />
    }
    const groups = new Map<string, Task[]>()
    for (const task of phase.tasks) {
      const key = task.roleId ?? ''
      groups.set(key, [...(groups.get(key) ?? []), task])
    }
    const rank = (id: string) => {
      const i = roleIds.indexOf(id)
      return i === -1 ? roleIds.length : i
    }
    const sections = [...groups.entries()].sort(([a], [b]) => rank(a) - rank(b))
    return (
      <div className="flex flex-col gap-10">
        {sections.map(([roleId, tasks]) => {
          const done = tasks.filter((t) => t.done).length
          const ordered = [...tasks].sort(
            (a, b) => Number(a.done) - Number(b.done)
          )
          return (
            <section key={roleId} className="flex flex-col gap-4">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="font-display text-ink text-xl font-bold tracking-tight uppercase">
                  {roleId ? roleLabel(roleId) : 'Other'}
                </h2>
                <span className="font-display text-text-subtle text-[11px] tracking-wider uppercase">
                  {done} of {tasks.length} done
                </span>
              </div>
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
      <PageHeader
        back={<Breadcrumbs items={[{ label: 'My work' }]} />}
        title="My work"
        subtitle={
          <span className="inline-block h-4 w-72 animate-pulse bg-gray-100" />
        }
      />
      <div className="grid grid-cols-2 border border-gray-200 bg-white sm:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 border-gray-200 px-4 py-3 not-last:border-b sm:not-last:border-r sm:not-last:border-b-0"
          >
            <span className="h-3 w-8 animate-pulse bg-gray-100" />
            <span className="h-4 w-24 animate-pulse bg-gray-100" />
            <span className="h-3 w-20 animate-pulse bg-gray-100" />
            <span className="mt-1 h-1 w-full bg-gray-100" />
          </div>
        ))}
      </div>
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
