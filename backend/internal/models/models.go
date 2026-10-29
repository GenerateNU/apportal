package models

import (
	"encoding/json"
	"time"
)

// Structs map to the tables in the init migration. Nullable columns use
// pointers; JSONB columns use json.RawMessage so they pass through untouched.

type User struct {
	NUID           string     `json:"nuid" gorm:"primaryKey"`
	Email          string     `json:"email" gorm:"not null;uniqueIndex:users_email_key"`
	FullName       string     `json:"full_name" gorm:"not null"`
	Roles          []UserRole `json:"roles" gorm:"serializer:pgarray;type:user_role[];not null;default:'{applicant}';index:idx_users_roles,type:gin"`
	GraduationYear *int       `json:"graduation_year,omitempty" gorm:"type:integer"`
	Major          *string    `json:"major,omitempty"`
	GithubUsername *string    `json:"github_username,omitempty"`
	CreatedAt      time.Time  `json:"created_at" gorm:"not null;default:now()"`
	UpdatedAt      time.Time  `json:"updated_at" gorm:"not null;default:now()"`
	// Returner marks someone who has worked on a Generate project before.
	// Set by a chief/admin, and deliberately on the person rather than an
	// application so it carries across cycles.
	Returner bool `json:"returner" gorm:"not null;default:false"`
}

type Cycle struct {
	ID              string          `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	Name            string          `json:"name" gorm:"not null"`
	Status          CycleStatus     `json:"status" gorm:"type:cycle_status;not null;default:draft"`
	ApplicationType ApplicationType `json:"application_type" gorm:"type:application_type;not null;default:member"`
	OpensAt         *time.Time      `json:"opens_at,omitempty"`
	ClosesAt        *time.Time      `json:"closes_at,omitempty"`
	CreatedAt       time.Time       `json:"created_at" gorm:"not null;default:now()"`
}

// ApplicationTemplate holds per-role application content within a cycle
// (e.g. Software Engineer vs Software Designer applications in the same
// cycle each get their own title/description/instructions/status). Status
// (mirroring cycle_status) is independent of the owning cycle's own status
// once set, letting a role's application lag or lead the cycle. ClosesAt is
// enforced (see deadlinePassed in handlers/applications.go) — new
// applications and draft edits are rejected once it passes.
//
// ReviewStatus/ReviewClosesAt are a separate open/closed state and deadline
// for when lead reviews should be done, tracked independently of the
// application side. Unlike ClosesAt, these are purely informational: nothing
// enforces them, so a lead can still submit a review after ReviewClosesAt
// passes.
type ApplicationTemplate struct {
	ID              string      `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	CycleID         string      `json:"cycle_id" gorm:"type:uuid;not null;uniqueIndex:application_templates_cycle_id_application_role_key,priority:1"`
	ApplicationRole Role        `json:"application_role" gorm:"type:application_role;not null;uniqueIndex:application_templates_cycle_id_application_role_key,priority:2"`
	Title           string      `json:"title" gorm:"not null"`
	Description     *string     `json:"description,omitempty"`
	Instructions    *string     `json:"instructions,omitempty"`
	OpensAt         *time.Time  `json:"opens_at,omitempty"`
	ClosesAt        *time.Time  `json:"closes_at,omitempty"`
	Status          CycleStatus `json:"status" gorm:"type:cycle_status;not null;default:draft"`
	CreatedAt       time.Time   `json:"created_at" gorm:"not null;default:now()"`
	UpdatedAt       time.Time   `json:"updated_at" gorm:"not null;default:now()"`
	ReviewStatus    CycleStatus `json:"review_status" gorm:"type:cycle_status;not null;default:draft"`
	ReviewClosesAt  *time.Time  `json:"review_closes_at,omitempty"`
	Cycle           Cycle       `json:"-" gorm:"foreignKey:CycleID;references:ID;constraint:OnDelete:CASCADE"`
}

type CycleStage struct {
	ID                  string           `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	CycleID             string           `json:"cycle_id" gorm:"type:uuid;not null;index:idx_cycle_stages_cycle;uniqueIndex:cycle_stages_cycle_id_stage_key,priority:1"`
	Stage               ApplicationStage `json:"stage" gorm:"type:application_stage;not null;uniqueIndex:cycle_stages_cycle_id_stage_key,priority:2"`
	DisplayOrder        int              `json:"display_order" gorm:"type:integer;not null"`
	IsActive            bool             `json:"is_active" gorm:"not null;default:true"`
	RequiredAssignments int              `json:"required_assignments" gorm:"type:integer;not null;default:0"`
	Label               *string          `json:"label,omitempty"`
	CreatedAt           time.Time        `json:"created_at" gorm:"not null;default:now()"`
	Cycle               Cycle            `json:"-" gorm:"foreignKey:CycleID;references:ID;constraint:OnDelete:CASCADE"`
}

type Question struct {
	ID           string          `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	CycleID      string          `json:"cycle_id" gorm:"type:uuid;not null;index:idx_questions_cycle_role,priority:1"`
	Role         *Role           `json:"role,omitempty" gorm:"column:application_role;type:application_role;index:idx_questions_cycle_role,priority:2"`
	QuestionText string          `json:"question_text" gorm:"not null"`
	QuestionType QuestionType    `json:"question_type" gorm:"type:question_type;not null;default:long_answer"`
	IsRequired   bool            `json:"is_required" gorm:"not null;default:true"`
	DisplayOrder int             `json:"display_order" gorm:"type:integer;not null;default:0"`
	Options      json.RawMessage `json:"options,omitempty" gorm:"serializer:jsonb;type:jsonb"`
	// PageTitle, when set, means a new page starts at this question, titled
	// PageTitle. Only role-specific questions may carry one — a global
	// question (Role == nil) is shared across every role's form at
	// potentially different relative positions, so a page boundary on one
	// wouldn't mean the same thing for another.
	PageTitle *string   `json:"page_title,omitempty"`
	CreatedAt time.Time `json:"created_at" gorm:"not null;default:now()"`
	Cycle     Cycle     `json:"-" gorm:"foreignKey:CycleID;references:ID;constraint:OnDelete:CASCADE"`
}

type CodeChallenge struct {
	ID           string     `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	CycleID      string     `json:"cycle_id" gorm:"type:uuid;not null"`
	Role         Role       `json:"role" gorm:"column:application_role;type:application_role;not null"`
	Name         string     `json:"name" gorm:"not null"`
	ChallengeURL *string    `json:"challenge_url,omitempty"`
	Instructions *string    `json:"instructions,omitempty"`
	DueAt        *time.Time `json:"due_at,omitempty"`
	CreatedAt    time.Time  `json:"created_at" gorm:"not null;default:now()"`
	Cycle        Cycle      `json:"-" gorm:"foreignKey:CycleID;references:ID"`
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
	Returner       bool      `json:"returner"`
}

// Applicants were merged into the users table.
func (Applicant) TableName() string { return "users" }

type Application struct {
	ID           string           `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	CycleID      string           `json:"cycle_id" gorm:"type:uuid;not null;index:idx_applications_cycle;uniqueIndex:applications_cycle_id_user_nuid_role_key,priority:1"`
	UserNUID     string           `json:"user_nuid" gorm:"not null;index:idx_applications_user;uniqueIndex:applications_cycle_id_user_nuid_role_key,priority:2"`
	Role         Role             `json:"role" gorm:"column:application_role;type:application_role;not null;uniqueIndex:applications_cycle_id_user_nuid_role_key,priority:3"`
	Stage        ApplicationStage `json:"stage" gorm:"type:application_stage;not null;default:draft;index:idx_applications_stage"`
	Availability json.RawMessage  `json:"availability,omitempty" gorm:"serializer:jsonb;type:jsonb"`
	ResumeURL    *string          `json:"resume_url,omitempty"`
	// SubmittedAt is nil until the applicant actually submits (draft ->
	// submitted); it is not the row's creation time.
	SubmittedAt *time.Time `json:"submitted_at,omitempty"`
	UpdatedAt   time.Time  `json:"updated_at" gorm:"not null;default:now()"`
	Cycle       Cycle      `json:"-" gorm:"foreignKey:CycleID;references:ID"`
	User        User       `json:"-" gorm:"foreignKey:UserNUID;references:NUID"`
}

// ApplicationSummary bundles an application with its applicant's display name
// and email (not a table) — spares reviewer-facing list views a separate
// per-application lookup against /applicants just to show who applied.
type ApplicationSummary struct {
	Application
	FullName string `json:"full_name"`
	Email    string `json:"email"`
	// Returner rides along from the joined user for the same reason the name
	// does — every reviewer list shows it, and none should pay a per-row
	// lookup for it.
	Returner bool `json:"returner"`
}

type WrittenAnswer struct {
	ID            string          `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	ApplicationID string          `json:"application_id" gorm:"type:uuid;not null;index:idx_written_answers_app;uniqueIndex:written_answers_application_id_question_id_key,priority:1"`
	QuestionID    string          `json:"question_id" gorm:"type:uuid;not null;uniqueIndex:written_answers_application_id_question_id_key,priority:2"`
	AnswerText    *string         `json:"answer_text,omitempty"`
	AnswerOptions json.RawMessage `json:"answer_options,omitempty" gorm:"serializer:jsonb;type:jsonb"`
	// AnswerFilePath/AnswerFileName let a `url`-type question be answered by
	// uploading a PDF instead of typing a link. AnswerFilePath is the opaque
	// Supabase Storage object key; AnswerFileName is the original filename,
	// kept separately for display since the storage path doesn't encode it.
	AnswerFilePath *string     `json:"answer_file_path,omitempty"`
	AnswerFileName *string     `json:"answer_file_name,omitempty"`
	SubmittedAt    time.Time   `json:"submitted_at" gorm:"not null;default:now()"`
	Application    Application `json:"-" gorm:"foreignKey:ApplicationID;references:ID;constraint:OnDelete:CASCADE"`
	Question       Question    `json:"-" gorm:"foreignKey:QuestionID;references:ID"`
}

type CodeSubmission struct {
	ID             string          `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	ApplicationID  string          `json:"application_id" gorm:"type:uuid;not null;index:idx_code_submissions_app;uniqueIndex:code_submissions_application_id_challenge_id_key,priority:1"`
	ChallengeID    string          `json:"challenge_id" gorm:"type:uuid;not null;uniqueIndex:code_submissions_application_id_challenge_id_key,priority:2"`
	SubmissionURL  string          `json:"submission_url" gorm:"not null"`
	SubmittedAt    time.Time       `json:"submitted_at" gorm:"not null;default:now()"`
	RawScore       *float64        `json:"raw_score,omitempty" gorm:"type:numeric"`
	ScoreDetails   json.RawMessage `json:"score_details,omitempty" gorm:"serializer:jsonb;type:jsonb"`
	ScoreUpdatedAt *time.Time      `json:"score_updated_at,omitempty"`
	Application    Application     `json:"-" gorm:"foreignKey:ApplicationID;references:ID;constraint:OnDelete:CASCADE"`
	Challenge      CodeChallenge   `json:"-" gorm:"foreignKey:ChallengeID;references:ID"`
}
