'use client'

import { useMemo } from 'react'
import { useCycleScope } from '@/hooks/useCycleScope'
import { useIsChief } from '@/lib/queries/cycle-staff'
import { useMyWork } from '@/lib/queries/my-work'
import { useApplications } from '@/lib/queries/applications'
import { useDecisions } from '@/lib/queries/decisions'
import { useDraftBoards } from '@/lib/queries/drafts'
import { useInterviewReviewersBulk } from '@/lib/queries/interview-assignments'
import {
  interviewSubmitted,
  useInterviewsByApplicationIds,
} from '@/lib/queries/interviews'
import {
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
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { feedbackState } from '../decisions/components/constants'
import { Fact } from '@/components/ui/facts'
import { CalendarClock } from 'lucide-react'

export type Task = {
  id: string
  title: string
  roleId?: string
  meta?: React.ReactNode
  status: { label: string; className?: string }
  done: boolean
  waiting?: boolean
  href: string
  action: string
}

export type Phase = {
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
  doneCount: number
  total: number
}

export const NOUNS: Record<Phase['id'], [string, string]> = {
  reviews: ['review', 'reviews'],
  interviews: ['interview', 'interviews'],
  interviewReviews: ['interview review', 'interview reviews'],
  preference: ['preference list', 'preference lists'],
  draft: ['draft', 'drafts'],
  feedback: ['feedback note', 'feedback notes'],
}

export const TASK_STATE = {
  todo: { label: 'To do', className: 'bg-gray-100 text-ink' },
  draft: { label: 'In progress', className: 'bg-chip-9-bg text-chip-9-text' },
  done: { label: 'Submitted', className: 'bg-status-open/15 text-status-open' },
  waiting: { label: 'Waiting', className: 'bg-gray-100 text-text-subtle' },
}

export function useLeadWork() {
  const { data: user } = useCurrentUser()
  const me = user?.nuid ?? ''
  const { cycle, branch, isLoading } = useCycleScope(
    useIsChief() ? 'chief' : 'lead'
  )
  const cycleId = cycle?.id ?? ''
  const { data: work = [], isPending: workPending } = useMyWork(cycleId)
  const ready = !!me && !!cycleId
  const { roleLabel } = useRoleLookup()

  const { data: reviewApps = [], isPending: reviewAppsPending } =
    useApplications({ assigned_to: me, cycle_id: cycleId }, undefined, {
      enabled: ready,
    })
  const { data: interviewApps = [], isPending: interviewAppsPending } =
    useApplications({ interviewer_nuid: me, cycle_id: cycleId }, undefined, {
      enabled: ready,
    })
  const { data: recordingApps = [], isPending: recordingAppsPending } =
    useApplications(
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

  const { data: lists = [], isPending: listsPending } =
    usePreferenceLists(cycleId)
  const { data: listDetails = [] } = usePreferenceListDetails(cycleId)
  const { roleIds } = useCycleRoles(cycleId)
  const { data: decisions = [], isPending: decisionsPending } =
    useDecisions(cycleId)
  const { data: boardsByRole } = useDraftBoards(cycleId, roleIds)
  const boards = useMemo(
    () => Object.values(boardsByRole ?? {}),
    [boardsByRole]
  )

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
            ? { ...TASK_STATE.todo, label: 'To be reviewed' }
            : TASK_STATE[state],
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
        meta: (
          <Fact icon={CalendarClock}>
            {interview?.scheduled_at
              ? formatDate(interview.scheduled_at)
              : 'Not scheduled yet'}
          </Fact>
        ),
        status:
          state === 'todo'
            ? { ...TASK_STATE.todo, label: 'To be interviewed' }
            : TASK_STATE[state],
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
            ? { ...TASK_STATE.todo, label: 'To be reviewed' }
            : TASK_STATE[state],
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
      const perRole = roleIds.map((roleId) => (
        <Badge key={roleId} size="sm" className="text-text-muted">
          {roleLabel(roleId)}
          <span className="tabular-nums">
            {entries.filter((e) => e.role_id === roleId).length}
          </span>
        </Badge>
      ))
      return {
        id: list.id,
        title: list.name,
        meta:
          perRole.length > 0 ? (
            <span className="inline-flex flex-wrap items-center gap-1.5">
              Ranked so far
              {perRole}
            </span>
          ) : undefined,
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
              meta: (
                <span className="flex flex-col gap-0.5">
                  {roleStatus.map((s) => (
                    <span key={s}>{s}</span>
                  ))}
                </span>
              ),
              status: allDone
                ? { label: 'Finished', className: TASK_STATE.done.className }
                : anyLive
                  ? { label: 'Live', className: TASK_STATE.done.className }
                  : TASK_STATE.waiting,
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
              ? { ...TASK_STATE.done, label: 'Sent' }
              : state === 'submitted'
                ? { ...TASK_STATE.done, label: 'Written' }
                : state === 'draft'
                  ? TASK_STATE.draft
                  : { ...TASK_STATE.todo, label: 'To be written' },
          done: state === 'submitted',
          href: `/reviewer/decisions/${row.application_id}`,
          action: state === 'submitted' ? 'View' : 'Write',
        }
      })

    const make = (
      id: Phase['id'],
      tasks: Task[],
      blurb: string,
      grouped = true,
      sections?: Phase['sections']
    ): Phase => {
      const status = work.find((w) => w.id === id)
      return {
        id,
        label: status?.label ?? id,
        tasks,
        blurb,
        deadline: status?.deadline,
        grouped,
        sections,
        open: !!status && status.status !== 'locked',
        locked: status?.locked_reason ?? '',
        done: status?.status === 'done',
        doneCount: status?.done ?? 0,
        total: status?.total ?? 0,
      }
    }

    return [
      make('reviews', reviewTasks, 'Read each application and score it.'),
      make(
        'interviews',
        interviewTasks,
        'Interview each applicant, then submit the recording, notes, write-up and rating.'
      ),
      make(
        'interviewReviews',
        recordingTasks,
        'Watch each recording and add your review.'
      ),
      make(
        'preference',
        listTasks,
        team
          ? `Rank the applicants ${team.name} wants for every role, then submit the whole list together.`
          : 'Rank the applicants your team wants for every role, then submit the whole list together.',
        false,
        [{ title: 'Your team', tasks: listTasks }]
      ),
      make(
        'draft',
        draftTasks,
        'Teams take turns picking. Follow along and see who is left on your list.',
        false
      ),
      make(
        'feedback',
        feedbackTasks,
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
    decisions,
    boards,
    work,
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
  const loadingWork =
    isLoading ||
    (!!cycleId && workPending) ||
    (!!cycle &&
      (!me || reviewAppsPending || writtenReviews.some((q) => q.isPending)))
  const tasksLoading: Record<Phase['id'], boolean> = {
    reviews: false,
    interviews: interviewAppsPending,
    interviewReviews: recordingAppsPending,
    preference: listsPending,
    draft: false,
    feedback: decisionsPending,
  }
  return {
    cycle,
    branch,
    phases,
    current,
    summary,
    roleIds,
    roleLabel,
    loading: loadingWork,
    tasksLoading,
  }
}
