// Central query key factory. Keep key shapes here so invalidation stays in
// sync across hooks — never hand-write a query key in a component.
import type {
  AnswerFilterParam,
  ApplicationStage,
  ReviewerRole,
  Role,
} from '@/lib/api/types'

export const queryKeys = {
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (reviewerRole?: ReviewerRole) =>
      [...queryKeys.users.lists(), reviewerRole ?? 'any'] as const,
    details: () => [...queryKeys.users.all, 'detail'] as const,
    detail: (nuid: string) => [...queryKeys.users.details(), nuid] as const,
    // Keyed by the Supabase auth uid (not sent to the backend — /users/me
    // takes no params) purely so switching signed-in identities in the same
    // tab gets a fresh cache entry instead of showing the previous user's
    // cached profile under the new session.
    me: (uid: string) => [...queryKeys.users.all, 'me', uid] as const,
  },

  applicants: {
    all: ['applicants'] as const,
    details: () => [...queryKeys.applicants.all, 'detail'] as const,
    detail: (nuid: string) =>
      [...queryKeys.applicants.details(), nuid] as const,
  },

  applications: {
    all: ['applications'] as const,
    lists: () => [...queryKeys.applications.all, 'list'] as const,
    list: (params?: {
      cycle_id?: string
      user_nuid?: string
      assigned_to?: string
      interviewer_nuid?: string
      recording_reviewer_nuid?: string
      stage?: ApplicationStage
      stages?: string
      role?: Role
      roles?: string
      rating_filters?: string
      answer_filters?: AnswerFilterParam[]
      returner?: boolean
    }) => [...queryKeys.applications.lists(), params ?? {}] as const,
    // Namespaced away from `list` because an infinite query caches
    // `{ pages, pageParams }` rather than a single response — sharing a key
    // with a plain list would put two different shapes in one entry.
    infiniteList: (params?: {
      cycle_id?: string
      user_nuid?: string
      assigned_to?: string
      stage?: ApplicationStage
      stages?: string
      role?: Role
      roles?: string
      rating_filters?: string
      answer_filters?: AnswerFilterParam[]
      returner?: boolean
      search?: string
      limit?: number
    }) =>
      [...queryKeys.applications.lists(), 'infinite', params ?? {}] as const,
    details: () => [...queryKeys.applications.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.applications.details(), id] as const,
  },

  cycles: {
    all: ['cycles'] as const,
    lists: () => [...queryKeys.cycles.all, 'list'] as const,
    list: (params?: { status?: string }) =>
      [...queryKeys.cycles.lists(), params ?? {}] as const,
    details: () => [...queryKeys.cycles.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.cycles.details(), id] as const,
    templateSummary: (id: string) =>
      [...queryKeys.cycles.all, 'template-summary', id] as const,
  },

  applicationTemplates: {
    all: ['application-templates'] as const,
    details: () => [...queryKeys.applicationTemplates.all, 'detail'] as const,
    detail: (cycleId: string, role: Role) =>
      [...queryKeys.applicationTemplates.details(), cycleId, role] as const,
    openList: () =>
      [...queryKeys.applicationTemplates.all, 'open-list'] as const,
  },

  questions: {
    all: ['questions'] as const,
    lists: () => [...queryKeys.questions.all, 'list'] as const,
    list: (cycleId: string, role?: Role) =>
      [...queryKeys.questions.lists(), cycleId, role ?? 'any'] as const,
  },

  reviewQuestions: {
    all: ['review-questions'] as const,
    lists: () => [...queryKeys.reviewQuestions.all, 'list'] as const,
    list: (cycleId: string, role?: Role) =>
      [...queryKeys.reviewQuestions.lists(), cycleId, role ?? 'any'] as const,
  },

  challenges: {
    all: ['challenges'] as const,
    lists: () => [...queryKeys.challenges.all, 'list'] as const,
    list: (cycleId: string, role?: Role) =>
      [...queryKeys.challenges.lists(), cycleId, role ?? 'any'] as const,
  },

  answers: {
    all: ['answers'] as const,
    lists: () => [...queryKeys.answers.all, 'list'] as const,
    list: (applicationId: string) =>
      [...queryKeys.answers.lists(), applicationId] as const,
    // One entry per batch of applications fetched together. Keyed by the exact
    // id list so a batch stays cached as more are loaded alongside it.
    bulk: (applicationIds: string[]) =>
      [...queryKeys.answers.all, 'bulk', applicationIds] as const,
  },

  submissions: {
    all: ['submissions'] as const,
    details: () => [...queryKeys.submissions.all, 'detail'] as const,
    detail: (applicationId: string) =>
      [...queryKeys.submissions.details(), applicationId] as const,
  },

  writtenReviews: {
    all: ['written-reviews'] as const,
    lists: () => [...queryKeys.writtenReviews.all, 'list'] as const,
    list: (applicationId: string) =>
      [...queryKeys.writtenReviews.lists(), applicationId] as const,
  },

  chiefReviews: {
    all: ['chief-reviews'] as const,
    lists: () => [...queryKeys.chiefReviews.all, 'list'] as const,
    list: (applicationId: string) =>
      [...queryKeys.chiefReviews.lists(), applicationId] as const,
    // One entry per batch of applications fetched together. Keyed by the exact
    // id list so a batch stays cached as more are loaded alongside it.
    bulk: (applicationIds: string[]) =>
      [...queryKeys.chiefReviews.all, 'bulk', applicationIds] as const,
  },

  chiefReviewComments: {
    all: ['chief-review-comments'] as const,
    lists: () => [...queryKeys.chiefReviewComments.all, 'list'] as const,
    list: (applicationId: string) =>
      [...queryKeys.chiefReviewComments.lists(), applicationId] as const,
  },

  leadAssignments: {
    all: ['lead-assignments'] as const,
    lists: () => [...queryKeys.leadAssignments.all, 'list'] as const,
    list: (applicationId: string) =>
      [...queryKeys.leadAssignments.lists(), applicationId] as const,
  },

  // Assignment planning is read-only and driven by teams the chief types in,
  // so only the pool size (cycle × role) is cached; capacity and preview are
  // mutations keyed by the in-flight team layout rather than queries.
  assignmentPlan: {
    all: ['assignment-plan'] as const,
    pool: (cycleId: string, role: Role) =>
      [...queryKeys.assignmentPlan.all, 'pool', cycleId, role] as const,
  },

  interviews: {
    all: ['interviews'] as const,
    details: () => [...queryKeys.interviews.all, 'detail'] as const,
    detail: (applicationId: string) =>
      [...queryKeys.interviews.details(), applicationId] as const,
    // One entry per batch of applications fetched together. Keyed by the exact
    // id list so a batch stays cached as more are loaded alongside it.
    bulk: (applicationIds: string[]) =>
      [...queryKeys.interviews.all, 'bulk', applicationIds] as const,
  },

  interviewAssignments: {
    all: ['interview-assignments'] as const,
    details: () => [...queryKeys.interviewAssignments.all, 'detail'] as const,
    detail: (applicationId: string) =>
      [...queryKeys.interviewAssignments.details(), applicationId] as const,
    // One entry per batch of applications fetched together. Keyed by the exact
    // id list so a batch stays cached as more are loaded alongside it.
    bulk: (applicationIds: string[]) =>
      [...queryKeys.interviewAssignments.all, 'bulk', applicationIds] as const,
  },

  interviewComments: {
    all: ['interview-comments'] as const,
    lists: () => [...queryKeys.interviewComments.all, 'list'] as const,
    list: (applicationId: string) =>
      [...queryKeys.interviewComments.lists(), applicationId] as const,
  },

  // A single global record, not scoped to a cycle/application — the key just
  // Scoped like applicationTemplates below: one script per (cycle, role).
  interviewScript: {
    all: ['interview-script'] as const,
    details: () => [...queryKeys.interviewScript.all, 'detail'] as const,
    detail: (cycleId: string, role: Role) =>
      [...queryKeys.interviewScript.details(), cycleId, role] as const,
  },

  recordingReviews: {
    all: ['recording-reviews'] as const,
    lists: () => [...queryKeys.recordingReviews.all, 'list'] as const,
    list: (interviewId: string) =>
      [...queryKeys.recordingReviews.lists(), interviewId] as const,
    // One entry per batch of interviews fetched together. Keyed by the exact
    // id list so a batch stays cached as more are loaded alongside it.
    bulk: (interviewIds: string[]) =>
      [...queryKeys.recordingReviews.all, 'bulk', interviewIds] as const,
  },

  challengeScore: {
    all: ['challenge-score'] as const,
    details: () => [...queryKeys.challengeScore.all, 'detail'] as const,
    detail: (nuid: string) =>
      [...queryKeys.challengeScore.details(), nuid] as const,
  },

  interviewReviewAssignments: {
    all: ['interview-review-assignments'] as const,
    lists: () => [...queryKeys.interviewReviewAssignments.all, 'list'] as const,
    list: (applicationId: string) =>
      [...queryKeys.interviewReviewAssignments.lists(), applicationId] as const,
    // One entry per batch of applications fetched together. Keyed by the exact
    // id list so a batch stays cached as more are loaded alongside it.
    bulk: (applicationIds: string[]) =>
      [
        ...queryKeys.interviewReviewAssignments.all,
        'bulk',
        applicationIds,
      ] as const,
  },

  // Same shape as assignmentPlan above: read-only, driven by a meeting-day
  // roster the chief types in, so only pool sizes are cached queries.
  interviewAssignmentPlan: {
    all: ['interview-assignment-plan'] as const,
    interviewerPool: (cycleId: string, role: Role) =>
      [
        ...queryKeys.interviewAssignmentPlan.all,
        'interviewer-pool',
        cycleId,
        role,
      ] as const,
    reviewerPool: (cycleId: string, role: Role) =>
      [
        ...queryKeys.interviewAssignmentPlan.all,
        'reviewer-pool',
        cycleId,
        role,
      ] as const,
  },

  reviewGates: {
    all: ['review-gates'] as const,
    lists: () => [...queryKeys.reviewGates.all, 'list'] as const,
    list: (cycleId: string) =>
      [...queryKeys.reviewGates.lists(), cycleId] as const,
  },

  reviewerProgress: {
    all: ['reviewer-progress'] as const,
    lists: () => [...queryKeys.reviewerProgress.all, 'list'] as const,
    list: (cycleId: string, role?: Role) =>
      [...queryKeys.reviewerProgress.lists(), cycleId, role ?? 'all'] as const,
  },

  reviewQuestionAverages: {
    all: ['review-question-averages'] as const,
    lists: () => [...queryKeys.reviewQuestionAverages.all, 'list'] as const,
    list: (cycleId: string, role?: Role) =>
      [
        ...queryKeys.reviewQuestionAverages.lists(),
        cycleId,
        role ?? 'all',
      ] as const,
  },

  preferenceLists: {
    all: ['preference-lists'] as const,
    lists: () => [...queryKeys.preferenceLists.all, 'list'] as const,
    list: (cycleId: string) =>
      [...queryKeys.preferenceLists.lists(), cycleId] as const,
    details: () => [...queryKeys.preferenceLists.all, 'detail'] as const,
    detail: (id: string) =>
      [...queryKeys.preferenceLists.details(), id] as const,
    // Every group's full detail for a cycle at once, for the chief/admin
    // "all groups side by side" board — a separate key from list()/detail(id)
    // since it carries a different shape (full PreferenceListDetail[]).
    allDetails: (cycleId: string) =>
      [...queryKeys.preferenceLists.all, 'all-details', cycleId] as const,
  },

  drafts: {
    all: ['drafts'] as const,
    board: (cycleId: string, role: Role) =>
      [...queryKeys.drafts.all, 'board', cycleId, role] as const,
    // Every board in the cycle at once — what marks an applicant as taken
    // wherever they're still listed.
    drafted: (cycleId: string) =>
      [...queryKeys.drafts.all, 'drafted', cycleId] as const,
  },

  decisions: {
    all: ['decisions'] as const,
    lists: () => [...queryKeys.decisions.all, 'list'] as const,
    // Every filtered list for one cycle shares this prefix, so a write that
    // moves a row between filters can invalidate them all at once.
    listsForCycle: (cycleId: string) =>
      [...queryKeys.decisions.lists(), cycleId] as const,
    list: (
      cycleId: string,
      params?: {
        role?: Role
        kind?: string
        interviewer_nuid?: string
        search?: string
      }
    ) => [...queryKeys.decisions.listsForCycle(cycleId), params ?? {}] as const,
    templates: (cycleId: string, role: Role) =>
      [...queryKeys.decisions.all, 'templates', cycleId, role] as const,
    // One entry per batch of applications fetched together. Keyed by the exact
    // id list so a batch stays cached as more are loaded alongside it.
    context: (applicationIds: string[]) =>
      [...queryKeys.decisions.all, 'context', applicationIds] as const,
  },

  preferenceListDeadline: {
    all: ['preference-list-deadline'] as const,
    detail: (cycleId: string, role: Role) =>
      [...queryKeys.preferenceListDeadline.all, cycleId, role] as const,
  },
} as const
