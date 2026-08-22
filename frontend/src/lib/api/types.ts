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
  ChallengeAttempt as GenChallengeAttempt,
  ChallengeScore as GenChallengeScore,
  CodeChallenge as GenCodeChallenge,
  CodeSubmission as GenCodeSubmission,
  Interview as GenInterview,
  InterviewAssignment as GenInterviewAssignment,
  InterviewCommentDetail as GenInterviewCommentDetail,
  InterviewRecordingReview as GenInterviewRecordingReview,
  InterviewReviewAssignment as GenInterviewReviewAssignment,
  InterviewScript as GenInterviewScript,
  LeadMeetingAvailability as GenLeadMeetingAvailability,
  PreferenceList as GenPreferenceList,
  PreferenceListDeadline as GenPreferenceListDeadline,
  PreferenceListDetail as GenPreferenceListDetail,
  PreferenceListEntry as GenPreferenceListEntry,
  PreferenceListEntryDetail as GenPreferenceListEntryDetail,
  PreferenceListMember as GenPreferenceListMember,
  PreferenceListSummary as GenPreferenceListSummary,
  Question as GenQuestion,
  QuestionAverageScore,
  ReviewerProgress as GenReviewerProgress,
  ReviewQuestion as GenReviewQuestion,
  ReviewQuestionAverage as GenReviewQuestionAverage,
  User as GenUser,
  WrittenAnswer as GenWrittenAnswer,
  WrittenReviewAnswer as GenWrittenReviewAnswer,
  WrittenReviewDetail as GenWrittenReviewDetail,
  ApplicationRole,
  ApplicationStage,
  InterviewRating,
  QuestionQuestionType,
  UserRolesAnyOfItem,
} from '@/generated/model'

// Enum aliases — same string values as the backend, friendlier names for the app.
export type {
  ApplicationStage,
  ChallengeMetrics,
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

export type ChallengeAttempt = GenChallengeAttempt

// An applicant's best finished expedition against the backend/scheduler
// technical challenge, read from that separate server's own database.
// attempts is nullable in the generated type (an empty Go slice can encode
// as `null`); callers always want an array.
export type ChallengeScore = Omit<GenChallengeScore, '$schema' | 'attempts'> & {
  attempts: ChallengeAttempt[]
}

export type ChiefReview = Omit<GenChiefReviewDetail, '$schema'>

export type ChiefReviewComment = Omit<GenChiefReviewCommentDetail, '$schema'>

// The interviewer's write-up for one application (one per application).
export type Interview = Omit<GenInterview, '$schema'>

export type InterviewRecordingReview = Omit<
  GenInterviewRecordingReview,
  '$schema' | 'rating'
> & {
  rating?: InterviewRating
}

export type InterviewComment = Omit<GenInterviewCommentDetail, '$schema'>

export interface InterviewScriptQuestion {
  prompt: string
  // Optional prompts to reach for if the applicant's first answer was thin.
  followUps?: string[]
}

export interface InterviewScriptChallengeTrack {
  label: string
  followUps: string[]
}

export interface InterviewScriptChallengeTracks {
  backend: InterviewScriptChallengeTrack
  frontend: InterviewScriptChallengeTrack
}

export type InterviewScript = Omit<
  GenInterviewScript,
  | '$schema'
  | 'questions'
  | 'challenge_tracks'
  | 'post_interview_checklist'
  | 'application_role'
> & {
  application_role: Role
  questions: InterviewScriptQuestion[]
  challenge_tracks: InterviewScriptChallengeTracks
  post_interview_checklist: string[]
}

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

export type ReviewQuestionAverage = Omit<GenReviewQuestionAverage, 'scores'> & {
  scores: NonNullable<GenReviewQuestionAverage['scores']>
}
export type { QuestionAverageScore }

export type PreferenceListStatus = 'draft' | 'submitted'

// The day-of-week set the application's own "Meeting Availability" question
// offers (see reviewer/applications/components/meetingAvailability.ts) — a
// preference list's members pick one of these to plan around.
export type MeetingDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday'

export type PreferenceList = Omit<
  GenPreferenceList,
  '$schema' | 'application_role' | 'status' | 'meeting_day'
> & {
  application_role: Role
  status: PreferenceListStatus
  meeting_day?: MeetingDay
}

// member_names is nullable in the generated type (an empty Go slice can
// encode as `null`); callers always want an array.
export type PreferenceListSummary = Omit<
  GenPreferenceListSummary,
  'application_role' | 'status' | 'member_names' | 'meeting_day'
> & {
  application_role: Role
  status: PreferenceListStatus
  member_names: string[]
  meeting_day?: MeetingDay
}

export type PreferenceListMember = Omit<GenPreferenceListMember, '$schema'>

export type PreferenceListEntry = Omit<GenPreferenceListEntry, '$schema'>

export type PreferenceListEntryDetail = GenPreferenceListEntryDetail

// members/entries are nullable in the generated type (an empty Go slice can
// encode as `null`); callers always want an array.
export type PreferenceListDetail = Omit<
  GenPreferenceListDetail,
  | '$schema'
  | 'application_role'
  | 'status'
  | 'members'
  | 'entries'
  | 'meeting_day'
> & {
  application_role: Role
  status: PreferenceListStatus
  members: PreferenceListMember[]
  entries: PreferenceListEntryDetail[]
  meeting_day?: MeetingDay
}

export type PreferenceListDeadline = Omit<
  GenPreferenceListDeadline,
  '$schema' | 'application_role'
> & {
  application_role: Role
}

// options is JSONB (a free-form checkbox-answer array) on the backend, so it
// arrives untyped; it's really the selected labels from the applicant's own
// "Meeting Availability" answer (e.g. ["Thursday 7:30-9:00 PM"]).
export type LeadMeetingAvailability = Omit<
  GenLeadMeetingAvailability,
  'options'
> & {
  options: string[]
}
