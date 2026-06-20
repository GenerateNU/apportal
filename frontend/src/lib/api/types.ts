// Types matching the Go backend models exactly.
// Keep in sync with backend/internal/models/models.go

export type Role = 'software_engineer' | 'software_designer'

export type ApplicationStage =
  | 'submitted'
  | 'tl_review'
  | 'chief_review'
  | 'interview_scheduled'
  | 'interview_conducted'
  | 'interview_review'
  | 'selection'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'

export type ReviewerRole = 'tl' | 'chief'

export type InterviewRating = 'do_not_hire' | 'good' | 'great' | 'must_hire'

export type QuestionType = 'short_answer' | 'long_answer' | 'multiple_choice' | 'checkbox' | 'url'

export type CycleStatus = 'draft' | 'open' | 'closed' | 'archived'

export interface User {
  nuid: string
  email: string
  full_name: string
  reviewer_role: ReviewerRole | null
  github_username: string | null
  created_at: string
  updated_at: string
}

export interface Cycle {
  id: string
  name: string
  status: CycleStatus
  opens_at: string | null
  closes_at: string | null
  created_at: string
}

export interface Question {
  id: string
  cycle_id: string
  role: Role | null
  question_text: string
  question_type: QuestionType
  is_required: boolean
  display_order: number
  options: string[] | null
  created_at: string
}

export interface CodeChallenge {
  id: string
  cycle_id: string
  role: Role
  name: string
  github_repo_url: string | null
  instructions: string | null
  due_at: string | null
  created_at: string
}

export interface Applicant {
  nuid: string
  email: string
  full_name: string
  github_username: string | null
  graduation_year: number | null
  major: string | null
  created_at: string
  updated_at: string
}

export interface Application {
  id: string
  cycle_id: string
  applicant_nuid: string
  role: Role
  stage: ApplicationStage
  availability: Record<string, boolean> | null
  resume_url: string | null
  submitted_at: string
  updated_at: string
}

export interface WrittenAnswer {
  id: string
  application_id: string
  question_id: string
  answer_text: string | null
  answer_options: string[] | null
  submitted_at: string
}

export interface CodeSubmission {
  id: string
  application_id: string
  challenge_id: string
  github_repo_url: string
  submitted_at: string
  raw_score: number | null
  score_details: Record<string, unknown> | null
  score_updated_at: string | null
}
