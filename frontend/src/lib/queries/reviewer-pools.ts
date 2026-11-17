import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addReviewConflict,
  autoAssignReviewers,
  listReviewConflicts,
  getReviewBoard,
  removeReviewConflict,
} from '@/generated/assignment-planning/assignment-planning'
import { listCycleStaff } from '@/generated/cycle-staff/cycle-staff'
import { listRoles } from '@/generated/roles/roles'
import type { CycleStaffMember } from '@/generated/model/cycleStaffMember'
import type { OpeningTeam } from '@/generated/model/openingTeam'
import type { StaffGroup } from '@/generated/model/staffGroup'
import {
  addStaffGroupMember,
  createStaffGroup,
  deleteStaffGroup,
  listOpeningTeams,
  listStaffGroups,
  removeStaffGroupMember,
  renameStaffGroup,
  setOpeningTeam,
} from '@/generated/staff-groups/staff-groups'
import type { AutoAssignPlan } from '@/generated/model/autoAssignPlan'
import type { BoardRow } from '@/generated/model/boardRow'
import {
  assignLead,
  unassignLead,
} from '@/generated/lead-assignments/lead-assignments'
import type { Conflict as ConflictRow } from '@/generated/model/conflict'
import { queryKeys } from './keys'

export type { AutoAssignPlan, ConflictRow }

export type StaffingData = {
  categories: { id: string; name: string; member_nuids: string[] }[]
  positions: {
    role_id: string
    review_groups: string[]
    interview_groups: string[]
    reviewers: string[]
    interviewers: string[]
  }[]
}

function eligible(groupIds: string[], groups: StaffGroup[], staff: string[]) {
  if (groupIds.length === 0) return staff
  const members = new Set(
    groups
      .filter((g) => groupIds.includes(g.id))
      .flatMap((g) => (g.members ?? []).map((m) => m.user_nuid))
  )
  return staff.filter((n) => members.has(n))
}

async function fetchStaffing(cycleId: string): Promise<StaffingData> {
  const [groups, teams, staff, roles] = await Promise.all([
    listStaffGroups(cycleId).then((r) => (r ?? []) as StaffGroup[]),
    listOpeningTeams(cycleId).then((r) => (r ?? []) as OpeningTeam[]),
    listCycleStaff(cycleId).then((r) => (r ?? []) as CycleStaffMember[]),
    listRoles({ cycle_id: cycleId }).then((r) => r ?? []),
  ])
  const nuids = staff.map((m) => m.user_nuid)
  const team = (roleId: string, kind: OpeningTeam['kind']) =>
    teams.find((t) => t.role_id === roleId && t.kind === kind)?.group_ids ?? []
  const roleIds = roles.map((r) => r.id)
  return {
    categories: groups.map((g) => ({
      id: g.id,
      name: g.name,
      member_nuids: (g.members ?? []).map((m) => m.user_nuid),
    })),
    positions: roleIds.map((roleId) => {
      const review = team(roleId, 'reviewer')
      const interview = team(roleId, 'interviewer')
      return {
        role_id: roleId,
        review_groups: review,
        interview_groups: interview,
        reviewers: eligible(review, groups, nuids),
        interviewers: eligible(interview, groups, nuids),
      }
    }),
  }
}

export function useStaffing(cycleId: string) {
  return useQuery({
    queryKey: queryKeys.staffing.detail(cycleId),
    queryFn: () => fetchStaffing(cycleId),
    enabled: !!cycleId,
  })
}

export function useStaffingMutations(cycleId: string) {
  const queryClient = useQueryClient()
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.staffing.detail(cycleId),
    })
  const current = () =>
    queryClient.getQueryData<StaffingData>(queryKeys.staffing.detail(cycleId))
  return {
    createCategory: useMutation({
      mutationFn: (name: string) => createStaffGroup(cycleId, { name }),
      onSuccess: refresh,
    }),
    updateCategory: useMutation({
      mutationFn: async (vars: {
        id: string
        name?: string
        members?: string[]
      }) => {
        if (vars.name !== undefined)
          await renameStaffGroup(cycleId, vars.id, { name: vars.name })
        if (vars.members) {
          const before =
            current()?.categories.find((c) => c.id === vars.id)?.member_nuids ??
            []
          await Promise.all([
            ...vars.members
              .filter((n) => !before.includes(n))
              .map((n) => addStaffGroupMember(cycleId, vars.id, n)),
            ...before
              .filter((n) => !vars.members!.includes(n))
              .map((n) => removeStaffGroupMember(cycleId, vars.id, n)),
          ])
        }
      },
      onSuccess: refresh,
    }),
    deleteCategory: useMutation({
      mutationFn: (id: string) => deleteStaffGroup(cycleId, id),
      onSuccess: refresh,
    }),
    setPosition: useMutation({
      mutationFn: (vars: {
        roleId: string
        reviewGroups: string[]
        interviewGroups: string[]
      }) =>
        Promise.all([
          setOpeningTeam(cycleId, vars.roleId, 'reviewer', {
            group_ids: vars.reviewGroups,
          }),
          setOpeningTeam(cycleId, vars.roleId, 'interviewer', {
            group_ids: vars.interviewGroups,
          }),
        ]),
      onSuccess: refresh,
    }),
  }
}

export function useReviewConflicts(cycleId: string) {
  return useQuery({
    queryKey: queryKeys.reviewConflicts.list(cycleId),
    queryFn: async () =>
      ((await listReviewConflicts(cycleId)) ?? []) as ConflictRow[],
    enabled: !!cycleId,
  })
}

export function useSetConflict(cycleId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (vars: {
      lead: string
      applicant: string
      remove?: boolean
    }) =>
      ((vars.remove
        ? await removeReviewConflict(cycleId, vars.lead, vars.applicant)
        : await addReviewConflict(cycleId, vars.lead, vars.applicant)) ??
        []) as ConflictRow[],
    onSuccess: (rows) =>
      queryClient.setQueryData(queryKeys.reviewConflicts.list(cycleId), rows),
  })
}

export function useAutoAssign(cycleId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { roleIds?: string[]; dryRun: boolean }) =>
      (await autoAssignReviewers(
        cycleId,
        { role_ids: vars.roleIds },
        { dry_run: vars.dryRun }
      )) as AutoAssignPlan,
    onSuccess: (_, vars) => {
      if (vars.dryRun) return
      for (const key of [
        queryKeys.reviewerProgress.all,
        queryKeys.leadAssignments.all,
        queryKeys.applications.all,
        queryKeys.reviewBoard.all,
      ]) {
        queryClient.invalidateQueries({ queryKey: key })
      }
    },
  })
}

export type BoardEntry = {
  applicationId: string
  applicantNuid: string
  name: string
  email: string
  roleId: string
  stage: string
  submittedAt?: string
  returner: boolean
  reviewers: {
    assignmentId: string
    leadNuid: string
    name: string
    submitted: boolean
    started: boolean
  }[]
}

// history also keeps everyone reviewed who has since moved on, for progress pages.
export function useReviewBoard(
  cycleId: string,
  { history = false }: { history?: boolean } = {}
) {
  return useQuery({
    queryKey: history
      ? [...queryKeys.reviewBoard.detail(cycleId), 'history']
      : queryKeys.reviewBoard.detail(cycleId),
    queryFn: async () =>
      (
        ((await getReviewBoard(cycleId, history ? { history } : undefined))
          ?.rows ?? []) as BoardRow[]
      ).map((r): BoardEntry => ({
        applicationId: r.application_id,
        applicantNuid: r.applicant_nuid,
        name: r.full_name,
        email: r.email,
        roleId: r.role_id,
        stage: r.stage,
        submittedAt: r.submitted_at,
        returner: r.returner,
        reviewers: (r.reviewers ?? []).map((x) => ({
          assignmentId: x.assignment_id,
          leadNuid: x.lead_nuid,
          name: x.full_name,
          submitted: x.submitted,
          started: x.started,
        })),
      })),
    enabled: !!cycleId,
  })
}

export function useBoardAssign(cycleId: string) {
  const queryClient = useQueryClient()
  const refresh = () => {
    for (const key of [
      queryKeys.reviewBoard.detail(cycleId),
      queryKeys.reviewerProgress.all,
      queryKeys.leadAssignments.all,
    ]) {
      queryClient.invalidateQueries({ queryKey: key })
    }
  }
  return {
    add: useMutation({
      mutationFn: (vars: { applicationId: string; leadNuid: string }) =>
        assignLead(vars.applicationId, { lead_nuid: vars.leadNuid }),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (assignmentId: string) => unassignLead(assignmentId),
      onSuccess: refresh,
    }),
  }
}
