import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addInterviewReviewer,
  addInterviewer,
  removeInterviewReviewer,
  removeInterviewer,
  unassignAllInterviewReviewers,
  unassignAllInterviewers,
} from '@/generated/interview-assignments/interview-assignments'
import {
  autoPlanInterviews,
  getInterviewBoard,
} from '@/generated/interview-planning/interview-planning'
import type { InterviewBoardRow } from '@/generated/model/interviewBoardRow'
import type { InterviewPlan } from '@/generated/model/interviewPlan'
import { queryKeys } from './keys'

export type Person = {
  assignmentId: string
  nuid: string
  name: string
  done: boolean
}

export type InterviewEntry = {
  applicationId: string
  applicantNuid: string
  name: string
  email: string
  roleId: string
  stage: string
  submittedAt?: string
  returner: boolean
  scheduledAt?: string
  started: boolean
  done: boolean
  interviewers: Person[]
  reviewers: Person[]
  available: string[]
}

const people = (xs?: InterviewBoardRow['interviewers'] | null): Person[] =>
  (xs ?? []).map((x) => ({
    assignmentId: x.assignment_id,
    nuid: x.nuid,
    name: x.full_name,
    done: x.done,
  }))

// history also keeps everyone interviewed who has since moved on, for progress pages.
export function useInterviewBoard(
  cycleId: string,
  { history = false }: { history?: boolean } = {}
) {
  return useQuery({
    queryKey: history
      ? [...queryKeys.interviewBoard.detail(cycleId), 'history']
      : queryKeys.interviewBoard.detail(cycleId),
    queryFn: async () =>
      (
        ((await getInterviewBoard(cycleId, history ? { history } : undefined))
          ?.rows ?? []) as InterviewBoardRow[]
      ).map((r): InterviewEntry => ({
        applicationId: r.application_id,
        applicantNuid: r.applicant_nuid,
        name: r.full_name,
        email: r.email,
        roleId: r.role_id,
        stage: r.stage,
        returner: false,
        scheduledAt: r.scheduled_at,
        started: r.started,
        done: r.done,
        interviewers: people(r.interviewers),
        reviewers: people(r.recording_reviewers),
        available: r.slot_ids ?? [],
      })),
    enabled: !!cycleId,
  })
}

export type Kind = 'interviewers' | 'reviewers'

export function useInterviewBoardMutations(cycleId: string) {
  const queryClient = useQueryClient()
  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.interviewBoard.detail(cycleId),
    })
    queryClient.invalidateQueries({ queryKey: queryKeys.interviews.all })
  }
  return {
    add: useMutation({
      mutationFn: async (v: {
        kind: Kind
        applicationId: string
        nuid: string
      }) => {
        if (v.kind === 'interviewers')
          await addInterviewer(v.applicationId, { interviewer_nuid: v.nuid })
        else
          await addInterviewReviewer(v.applicationId, { reviewer_nuid: v.nuid })
      },
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: async (v: { kind: Kind; assignmentId: string }) => {
        if (v.kind === 'interviewers') await removeInterviewer(v.assignmentId)
        else await removeInterviewReviewer(v.assignmentId)
      },
      onSuccess: refresh,
    }),
    clear: useMutation({
      mutationFn: async (v: { roleId: string; reviewers: boolean }) => {
        if (v.reviewers)
          await unassignAllInterviewReviewers(cycleId, { role_id: v.roleId })
        await unassignAllInterviewers(cycleId, { role_id: v.roleId })
      },
      onSuccess: refresh,
    }),
    auto: useMutation({
      mutationFn: async (v: {
        roleIds: string[]
        withRecording: boolean
        byPanel: boolean
        matchSlots: boolean
        dryRun: boolean
      }) =>
        (await autoPlanInterviews(
          cycleId,
          {
            role_ids: v.roleIds,
            with_recording: v.withRecording,
            by_panel: v.byPanel,
            match_slots: v.matchSlots,
          },
          { dry_run: v.dryRun }
        )) as InterviewPlan,
      onSuccess: (_, v) => {
        if (!v.dryRun) refresh()
      },
    }),
  }
}
