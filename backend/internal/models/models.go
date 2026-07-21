package models

import (
	"encoding/json"
	"time"
)

// Structs map to the tables in the init migration. Nullable columns use
// pointers; JSONB columns use json.RawMessage so they pass through untouched.

type User struct {
	NUID           string     `json:"nuid"`
	Email          string     `json:"email"`
	FullName       string     `json:"full_name"`
	Roles          []UserRole `json:"roles"`
	GraduationYear *int       `json:"graduation_year,omitempty"`
	Major          *string    `json:"major,omitempty"`
	GithubUsername *string    `json:"github_username,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

type Cycle struct {
	ID              string          `json:"id"`
	Name            string          `json:"name"`
	Status          CycleStatus     `json:"status"`
	ApplicationType ApplicationType `json:"application_type"`
	OpensAt         *time.Time      `json:"opens_at,omitempty"`
	ClosesAt        *time.Time      `json:"closes_at,omitempty"`
	CreatedAt       time.Time       `json:"created_at"`
}

// ApplicationTemplate holds per-role application content within a cycle
// (e.g. Software Engineer vs Software Designer applications in the same
// cycle each get their own title/description/instructions). OpensAt/
// ClosesAt/IsPublished are stored for future use but are not yet enforced
// anywhere — cycle-level status/dates remain the only thing that gates
// access.
type ApplicationTemplate struct {
	ID              string     `json:"id"`
	CycleID         string     `json:"cycle_id"`
	ApplicationRole Role       `json:"application_role"`
	Title           string     `json:"title"`
	Description     *string    `json:"description,omitempty"`
	Instructions    *string    `json:"instructions,omitempty"`
	OpensAt         *time.Time `json:"opens_at,omitempty"`
	ClosesAt        *time.Time `json:"closes_at,omitempty"`
	IsPublished     bool       `json:"is_published"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type CycleStage struct {
	ID                  string           `json:"id"`
	CycleID             string           `json:"cycle_id"`
	Stage               ApplicationStage `json:"stage"`
	DisplayOrder        int              `json:"display_order"`
	IsActive            bool             `json:"is_active"`
	RequiredAssignments int              `json:"required_assignments"`
	Label               *string          `json:"label,omitempty"`
	CreatedAt           time.Time        `json:"created_at"`
}

type Question struct {
	ID           string          `json:"id"`
	CycleID      string          `json:"cycle_id"`
	Role         *Role           `json:"role,omitempty"`
	QuestionText string          `json:"question_text"`
	QuestionType QuestionType    `json:"question_type"`
	IsRequired   bool            `json:"is_required"`
	DisplayOrder int             `json:"display_order"`
	Options      json.RawMessage `json:"options,omitempty"`
	CreatedAt    time.Time       `json:"created_at"`
}

type CodeChallenge struct {
	ID           string     `json:"id"`
	CycleID      string     `json:"cycle_id"`
	Role         Role       `json:"role"`
	Name         string     `json:"name"`
	ChallengeURL *string    `json:"challenge_url,omitempty"`
	Instructions *string    `json:"instructions,omitempty"`
	DueAt        *time.Time `json:"due_at,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
}

// CycleRoleSummary reports one applicant role's template counts within a
// cycle: how many questions apply to it (role-specific plus global,
// role IS NULL), how many code challenges, and how many applications have
// been submitted. Computed via COUNT queries rather than requiring callers to
// fetch the full row sets just to take their length.
type CycleRoleSummary struct {
	Role            Role `json:"role"`
	QuestionCount   int  `json:"question_count"`
	ChallengeCount  int  `json:"challenge_count"`
	SubmissionCount int  `json:"submission_count"`
}

type Applicant struct {
	NUID           string    `json:"nuid"`
	Email          string    `json:"email"`
	FullName       string    `json:"full_name"`
	GithubUsername *string   `json:"github_username,omitempty"`
	GraduationYear *int      `json:"graduation_year,omitempty"`
	Major          *string   `json:"major,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type Application struct {
	ID           string           `json:"id"`
	CycleID      string           `json:"cycle_id"`
	UserNUID     string           `json:"user_nuid"`
	Role         Role             `json:"role"`
	Stage        ApplicationStage `json:"stage"`
	Availability json.RawMessage  `json:"availability,omitempty"`
	ResumeURL    *string          `json:"resume_url,omitempty"`
	SubmittedAt  time.Time        `json:"submitted_at"`
	UpdatedAt    time.Time        `json:"updated_at"`
}

type WrittenAnswer struct {
	ID            string          `json:"id"`
	ApplicationID string          `json:"application_id"`
	QuestionID    string          `json:"question_id"`
	AnswerText    *string         `json:"answer_text,omitempty"`
	AnswerOptions json.RawMessage `json:"answer_options,omitempty"`
	SubmittedAt   time.Time       `json:"submitted_at"`
}

type CodeSubmission struct {
	ID             string          `json:"id"`
	ApplicationID  string          `json:"application_id"`
	ChallengeID    string          `json:"challenge_id"`
	SubmissionURL  string          `json:"submission_url"`
	SubmittedAt    time.Time       `json:"submitted_at"`
	RawScore       *float64        `json:"raw_score,omitempty"`
	ScoreDetails   json.RawMessage `json:"score_details,omitempty"`
	ScoreUpdatedAt *time.Time      `json:"score_updated_at,omitempty"`
}
