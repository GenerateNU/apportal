// App-facing domain types, derived from the Orval-generated models so they
// track the backend spec automatically. We only override the parts the OpenAPI
// spec can't express precisely:
//   - JSONB fields the backend serializes as free-form JSON (Orval types these
//     as `unknown`); we pin the real shapes the UI relies on.
//   - A few nullable fields the app treats as `T | null`.
// Everything else flows straight from `@/generated/model`.
import type {
  Applicant as GenApplicant,
  Application as GenApplication,
  ApplicationSummary as GenApplicationSummary,
  ApplicationTemplate as GenApplicationTemplate,
  ChiefReviewCommentDetail as GenChiefReviewCommentDetail,
  ChiefReviewDetail as GenChiefReviewDetail,
  ChiefReviewDetailVote,
  Cycle as GenCycle,
  CodeChallenge as GenCodeChallenge,
  CodeSubmission as GenCodeSubmission,
  InterviewAssignment as GenInterviewAssignment,
  InterviewReviewAssignment as GenInterviewReviewAssignment,
  Question as GenQuestion,
  ReviewerProgress as GenReviewerProgress,
  ReviewQuestion as GenReviewQuestion,
  User as GenUser,
  WrittenAnswer as GenWrittenAnswer,
  WrittenReviewAnswer as GenWrittenReviewAnswer,
  WrittenReviewDetail as GenWrittenReviewDetail,
  ApplicationRole,
  ApplicationStage,
  QuestionQuestionType,
  UserRolesAnyOfItem,
} from '@/generated/model'

// Enum aliases — same string values as the backend, friendlier names for the app.
export type {
  ApplicationStage,
  InterviewRating,
  CycleStatus,
  CycleRoleSummary,
} from '@/generated/model'
export type Role = ApplicationRole
export type QuestionType = QuestionQuestionType
export type UserRole = UserRolesAnyOfItem
export type ChiefVote = ChiefReviewDetailVote

// The reviewer role passed as the list-users filter. Not a standalone backend
// enum (it's just a query param), so it stays hand-written.
export type ReviewerRole = 'tl' | 'chief'

// One entry of the list-applications answer_filters param. Hand-written for
// the same reason as ReviewerRole: it crosses the wire JSON-encoded inside a
// string param, so the generated types only see the string.
export interface AnswerFilterParam {
  question_id: string
  question_type: QuestionType
  // A substring for free-text questions, the chosen labels for choice ones.
  // A filter matches any of them; separate filters are AND'd.
  values: string | string[]
}

export type User = Omit<GenUser, '$schema' | 'roles'> & {
  roles: UserRole[]
}

export type Cycle = Omit<GenCycle, '$schema'>

export type ApplicationTemplate = Omit<GenApplicationTemplate, '$schema'>

export type Applicant = Omit<GenApplicant, '$schema'>

export type Question = Omit<GenQuestion, '$schema' | 'options' | 'role'> & {
  // JSONB array of choice labels (multiple_choice / checkbox questions).
  options: string[] | null
  role: Role | null
}

// Same shape as Question, minus page_title (review forms are short; no
// multi-page need) — a chief-defined rubric question for lead written
// reviews, scoped to a cycle and (optionally) a specific role.
export type ReviewQuestion = Omit<
  GenReviewQuestion,
  '$schema' | 'options' | 'role'
> & {
  options: string[] | null
  role: Role | null
}

export type CodeChallenge = Omit<GenCodeChallenge, '$schema'>

export type Application = Omit<
  GenApplication,
  '$schema' | 'availability' | 'resume_url'
> & {
  // JSONB availability blob keyed by slot.
  availability: Record<string, boolean> | null
  resume_url: string | null
}

// An application bundled with its applicant's full_name/email — what the
// reviewer applications list actually returns, so the frontend never needs a
// separate applicant-profile fetch just to show who applied.
export type ApplicationSummary = Omit<
  GenApplicationSummary,
  'availability' | 'resume_url' | 'role' | 'stage'
> & {
  availability: Record<string, boolean> | null
  resume_url: string | null
  role: Role
  stage: ApplicationStage
}

export type WrittenAnswer = Omit<GenWrittenAnswer, 'answer_options'> & {
  // JSONB array of selected choice labels.
  answer_options: string[] | null
}

// A reviewer's answer to one ReviewQuestion within a written review.
export type WrittenReviewAnswer = Omit<
  GenWrittenReviewAnswer,
  'answer_options'
> & {
  answer_options: string[] | null
}

export type WrittenReviewDetail = Omit<
  GenWrittenReviewDetail,
  '$schema' | 'answers'
> & {
  answers: WrittenReviewAnswer[]
}

export type CodeSubmission = Omit<GenCodeSubmission, '$schema'>

export type ChiefReview = Omit<GenChiefReviewDetail, '$schema'>

export type ChiefReviewComment = Omit<GenChiefReviewCommentDetail, '$schema'>

export type InterviewAssignment = Omit<GenInterviewAssignment, '$schema'>

export type InterviewReviewAssignment = Omit<
  GenInterviewReviewAssignment,
  '$schema'
>

// items is nullable in the generated type (an empty Go slice can encode as
// `null`); callers always want an array.
export type ReviewerProgress = Omit<GenReviewerProgress, 'items'> & {
  items: NonNullable<GenReviewerProgress['items']>
}
