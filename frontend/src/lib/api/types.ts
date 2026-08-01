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
  ChiefReview as GenChiefReview,
  Cycle as GenCycle,
  CodeChallenge as GenCodeChallenge,
  CodeSubmission as GenCodeSubmission,
  Question as GenQuestion,
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

// The reviewer role passed as the list-users filter. Not a standalone backend
// enum (it's just a query param), so it stays hand-written.
export type ReviewerRole = 'tl' | 'chief'

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

export type ChiefReview = Omit<GenChiefReview, '$schema'>
