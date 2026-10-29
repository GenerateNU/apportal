package models

import (
	"encoding/json"
	"time"
)

// Structs for the review → interview → selection pipeline.

// LeadAssignment: a chief assigns a lead to write-review an application. A cycle
// stage's required_assignments (3 for lead_review) gates advancement.
type LeadAssignment struct {
	ID            string      `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	ApplicationID string      `json:"application_id" gorm:"type:uuid;not null;index:idx_lead_assignments_app;uniqueIndex:tl_assignments_application_id_tl_nuid_key,priority:1"`
	LeadNUID      string      `json:"lead_nuid" gorm:"not null;index:idx_lead_assignments_lead;uniqueIndex:tl_assignments_application_id_tl_nuid_key,priority:2"`
	AssignedBy    string      `json:"assigned_by" gorm:"not null"`
	AssignedAt    time.Time   `json:"assigned_at" gorm:"not null;default:now()"`
	Application   Application `json:"-" gorm:"foreignKey:ApplicationID;references:ID;constraint:OnDelete:CASCADE"`
	Lead          User        `json:"-" gorm:"foreignKey:LeadNUID;references:NUID"`
	Assigner      User        `json:"-" gorm:"foreignKey:AssignedBy;references:NUID"`
}

// WrittenReview: a lead's review of an application. The rubric itself (what
// questions get answered) is dynamic — see ReviewQuestion/WrittenReviewAnswer.
type WrittenReview struct {
	ID            string      `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	ApplicationID string      `json:"application_id" gorm:"type:uuid;not null;index:idx_written_reviews_app;uniqueIndex:written_reviews_application_id_reviewer_nuid_key,priority:1"`
	ReviewerNUID  string      `json:"reviewer_nuid" gorm:"not null;uniqueIndex:written_reviews_application_id_reviewer_nuid_key,priority:2"`
	SubmittedAt   *time.Time  `json:"submitted_at,omitempty"`
	CreatedAt     time.Time   `json:"created_at" gorm:"not null;default:now()"`
	UpdatedAt     time.Time   `json:"updated_at" gorm:"not null;default:now()"`
	Application   Application `json:"-" gorm:"foreignKey:ApplicationID;references:ID;constraint:OnDelete:CASCADE"`
	Reviewer      User        `json:"-" gorm:"foreignKey:ReviewerNUID;references:NUID"`
}

// ReviewQuestion: a chief-defined rubric question for lead written reviews,
// scoped to a cycle and (optionally) a specific role — same shape as
// Question, minus PageTitle (review forms are short; no multi-page need)
// and plus Description.
type ReviewQuestion struct {
	ID           string          `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	CycleID      string          `json:"cycle_id" gorm:"type:uuid;not null"`
	Role         *Role           `json:"role,omitempty" gorm:"column:application_role;type:application_role"`
	QuestionText string          `json:"question_text" gorm:"not null"`
	QuestionType QuestionType    `json:"question_type" gorm:"type:question_type;not null;default:long_answer"`
	IsRequired   bool            `json:"is_required" gorm:"not null;default:true"`
	DisplayOrder int             `json:"display_order" gorm:"type:integer;not null;default:0"`
	Options      json.RawMessage `json:"options,omitempty" gorm:"serializer:jsonb;type:jsonb"`
	Description  *string         `json:"description,omitempty"`
	CreatedAt    time.Time       `json:"created_at" gorm:"not null;default:now()"`
	Cycle        Cycle           `json:"-" gorm:"foreignKey:CycleID;references:ID;constraint:OnDelete:CASCADE"`
}

// WrittenReviewAnswer: a reviewer's answer to one ReviewQuestion within a
// written review — replaces the old fixed overall_score/reasoning columns.
type WrittenReviewAnswer struct {
	ID               string          `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	ReviewID         string          `json:"review_id" gorm:"type:uuid;not null;uniqueIndex:written_review_answers_review_id_review_question_id_key,priority:1"`
	ReviewQuestionID string          `json:"review_question_id" gorm:"type:uuid;not null;uniqueIndex:written_review_answers_review_id_review_question_id_key,priority:2"`
	AnswerText       *string         `json:"answer_text,omitempty"`
	AnswerOptions    json.RawMessage `json:"answer_options,omitempty" gorm:"serializer:jsonb;type:jsonb"`
	Score            *int            `json:"score,omitempty" gorm:"type:integer;check:written_review_answers_score_check,score >= 1 AND score <= 10"`
	SubmittedAt      time.Time       `json:"submitted_at" gorm:"not null;default:now()"`
	Review           WrittenReview   `json:"-" gorm:"foreignKey:ReviewID;references:ID;constraint:OnDelete:CASCADE"`
	ReviewQuestion   ReviewQuestion  `json:"-" gorm:"foreignKey:ReviewQuestionID;references:ID"`
}

// WrittenReviewDetail bundles a review with its answers to the cycle/role's
// review questions (not a table). ReviewerName is resolved separately (not a
// join on written_reviews) so callers can display who wrote each review
// without needing the chief-only user-directory endpoints.
type WrittenReviewDetail struct {
	WrittenReview
	Answers      []WrittenReviewAnswer `json:"answers"`
	ReviewerName string                `json:"reviewer_name,omitempty"`
}

// ReviewGate reports the blind-review state of one review kind for one applicant
// role across a whole cycle (not a table). AssignedCount/SubmittedCount let
// chiefs track progress at any point; Released is true once a chief has ungated
// everyone's reviews for all reviewers. Releasing/hiding is per cycle × role,
// not per application.
type ReviewGate struct {
	CycleID        string     `json:"cycle_id"`
	Role           Role       `json:"role"`
	Kind           ReviewKind `json:"kind"`
	AssignedCount  int        `json:"assigned_count"`
	SubmittedCount int        `json:"submitted_count"`
	Released       bool       `json:"released"`
	ReleasedBy     *string    `json:"released_by,omitempty"`
	ReleasedAt     *time.Time `json:"released_at,omitempty"`
}

// ReviewerProgress reports one lead's write-review queue for a cycle × role:
// every application they're assigned, and whether each is submitted (not a
// table — built by joining lead_assignments with written_reviews).
type ReviewerProgress struct {
	LeadNUID string                 `json:"lead_nuid"`
	FullName string                 `json:"full_name"`
	Items    []ReviewerProgressItem `json:"items"`
}

// ReviewerProgressItem is one application within a ReviewerProgress queue.
type ReviewerProgressItem struct {
	ApplicationID string     `json:"application_id"`
	ApplicantNUID string     `json:"applicant_nuid"`
	FullName      string     `json:"full_name"`
	Email         string     `json:"email"`
	AssignedAt    time.Time  `json:"assigned_at"`
	SubmittedAt   *time.Time `json:"submitted_at,omitempty"`
}

// ReviewQuestionAverage reports one lead's average score on each of a
// cycle × role's score-type review questions — a calibration check for
// whether a lead scores certain questions systematically higher or lower
// than their peers (not a table — aggregated from written_review_answers).
type ReviewQuestionAverage struct {
	LeadNUID string                 `json:"lead_nuid"`
	FullName string                 `json:"full_name"`
	Scores   []QuestionAverageScore `json:"scores"`
}

// QuestionAverageScore is one review question's average within a
// ReviewQuestionAverage.
type QuestionAverageScore struct {
	ReviewQuestionID string  `json:"review_question_id"`
	AvgScore         float64 `json:"avg_score"`
	Count            int     `json:"count"`
}

// ChiefReview: a chief's individual vote on an application, after the lead
// written reviews are in. One row per chief per application — see ChiefVote
// for what each chief's vote means; the final advance/reject call is made
// separately (by changing the application's stage) after discussing
// everyone's votes. Discussion itself happens as ChiefReviewComments.
type ChiefReview struct {
	ID            string      `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	ApplicationID string      `json:"application_id" gorm:"type:uuid;not null;index:idx_chief_reviews_app;uniqueIndex:chief_reviews_application_id_reviewer_nuid_key,priority:1"`
	ReviewerNUID  string      `json:"reviewer_nuid" gorm:"not null;uniqueIndex:chief_reviews_application_id_reviewer_nuid_key,priority:2"`
	Vote          *ChiefVote  `json:"vote,omitempty" gorm:"check:chief_reviews_vote_check,vote IN ('strong_interview','interview','neutral','no_interview','strong_no_interview')"`
	DecidedAt     *time.Time  `json:"decided_at,omitempty"`
	CreatedAt     time.Time   `json:"created_at" gorm:"not null;default:now()"`
	UpdatedAt     time.Time   `json:"updated_at" gorm:"not null;default:now()"`
	Application   Application `json:"-" gorm:"foreignKey:ApplicationID;references:ID;constraint:OnDelete:CASCADE"`
	Reviewer      User        `json:"-" gorm:"foreignKey:ReviewerNUID;references:NUID"`
}

// ChiefReviewDetail bundles a chief review with the chief's resolved display
// name (not a table column — see WrittenReviewDetail.ReviewerName).
type ChiefReviewDetail struct {
	ChiefReview
	ReviewerName string `json:"reviewer_name,omitempty"`
}

// ChiefReviewComment is one comment a chief left on an application, separate
// from their vote. A chief may leave any number of these and edit their own.
type ChiefReviewComment struct {
	ID            string      `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	ApplicationID string      `json:"application_id" gorm:"type:uuid;not null;index:idx_chief_review_comments_app"`
	AuthorNUID    string      `json:"author_nuid" gorm:"not null"`
	Body          string      `json:"body" gorm:"not null"`
	CreatedAt     time.Time   `json:"created_at" gorm:"not null;default:now()"`
	UpdatedAt     time.Time   `json:"updated_at" gorm:"not null;default:now()"`
	Application   Application `json:"-" gorm:"foreignKey:ApplicationID;references:ID;constraint:OnDelete:CASCADE"`
	Author        User        `json:"-" gorm:"foreignKey:AuthorNUID;references:NUID"`
}

// ChiefReviewCommentDetail bundles a comment with the author's resolved
// display name (not a table column).
type ChiefReviewCommentDetail struct {
	ChiefReviewComment
	AuthorName string `json:"author_name,omitempty"`
}

// InterviewAssignment: the single interviewer assigned to an application.
type InterviewAssignment struct {
	ID              string      `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	ApplicationID   string      `json:"application_id" gorm:"type:uuid;not null;index:idx_interview_assignments_app;uniqueIndex:interview_assignments_application_id_key"`
	AssignedBy      string      `json:"assigned_by" gorm:"not null"`
	InterviewerNUID string      `json:"interviewer_nuid" gorm:"not null;index:idx_interview_assignments_interviewer"`
	AssignedAt      time.Time   `json:"assigned_at" gorm:"not null;default:now()"`
	Application     Application `json:"-" gorm:"foreignKey:ApplicationID;references:ID;constraint:OnDelete:CASCADE"`
	Assigner        User        `json:"-" gorm:"foreignKey:AssignedBy;references:NUID"`
	Interviewer     User        `json:"-" gorm:"foreignKey:InterviewerNUID;references:NUID"`
}

// InterviewReviewAssignment: a lead assigned to review the interview recording.
type InterviewReviewAssignment struct {
	ID            string      `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	ApplicationID string      `json:"application_id" gorm:"type:uuid;not null;index:idx_interview_rev_assign_app;uniqueIndex:interview_review_assignments_application_id_tl_nuid_key,priority:1"`
	LeadNUID      string      `json:"lead_nuid" gorm:"not null;uniqueIndex:interview_review_assignments_application_id_tl_nuid_key,priority:2"`
	AssignedBy    string      `json:"assigned_by" gorm:"not null"`
	AssignedAt    time.Time   `json:"assigned_at" gorm:"not null;default:now()"`
	Application   Application `json:"-" gorm:"foreignKey:ApplicationID;references:ID;constraint:OnDelete:CASCADE"`
	Lead          User        `json:"-" gorm:"foreignKey:LeadNUID;references:NUID"`
	Assigner      User        `json:"-" gorm:"foreignKey:AssignedBy;references:NUID"`
}

// Interview: filled out by the interviewer after conducting the interview.
type Interview struct {
	ID              string     `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	ApplicationID   string     `json:"application_id" gorm:"type:uuid;not null;index:idx_interviews_app;uniqueIndex:interviews_application_id_key"`
	InterviewerNUID string     `json:"interviewer_nuid" gorm:"not null"`
	ScheduledAt     *time.Time `json:"scheduled_at,omitempty"`
	ConductedAt     *time.Time `json:"conducted_at,omitempty"`
	RecordingURL    *string    `json:"recording_url,omitempty"`
	// NotesURL links to the interviewer's notes doc (e.g. a Granola summary),
	// alongside RecordingURL.
	NotesURL    *string          `json:"notes_url,omitempty" gorm:"comment:link to the interviewer's notes doc (e.g. Granola)"`
	Comments    *string          `json:"comments,omitempty"`
	Rating      *InterviewRating `json:"rating,omitempty" gorm:"type:interview_rating"`
	SubmittedAt *time.Time       `json:"submitted_at,omitempty"`
	CreatedAt   time.Time        `json:"created_at" gorm:"not null;default:now()"`
	UpdatedAt   time.Time        `json:"updated_at" gorm:"not null;default:now()"`
	Application Application      `json:"-" gorm:"foreignKey:ApplicationID;references:ID;constraint:OnDelete:CASCADE"`
	Interviewer User             `json:"-" gorm:"foreignKey:InterviewerNUID;references:NUID"`
}

// InterviewRecordingReview: an assigned lead's review of an interview recording.
type InterviewRecordingReview struct {
	ID           string           `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	InterviewID  string           `json:"interview_id" gorm:"type:uuid;not null;index:idx_recording_reviews_inter;uniqueIndex:interview_recording_reviews_interview_id_reviewer_nuid_key,priority:1"`
	ReviewerNUID string           `json:"reviewer_nuid" gorm:"not null;uniqueIndex:interview_recording_reviews_interview_id_reviewer_nuid_key,priority:2"`
	Comments     *string          `json:"comments,omitempty"`
	Rating       *InterviewRating `json:"rating,omitempty" gorm:"type:interview_rating"`
	SubmittedAt  *time.Time       `json:"submitted_at,omitempty"`
	CreatedAt    time.Time        `json:"created_at" gorm:"not null;default:now()"`
	UpdatedAt    time.Time        `json:"updated_at" gorm:"not null;default:now()"`
	Interview    Interview        `json:"-" gorm:"foreignKey:InterviewID;references:ID;constraint:OnDelete:CASCADE"`
	Reviewer     User             `json:"-" gorm:"foreignKey:ReviewerNUID;references:NUID"`
}

// InterviewComment is an open comment on an application's interview, visible
// to and postable by any reviewer — unlike ChiefReviewComment, not restricted
// to chiefs, since interview calibration is meant to be a shared discussion.
type InterviewComment struct {
	ID            string      `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	ApplicationID string      `json:"application_id" gorm:"type:uuid;not null;index:idx_interview_comments_app"`
	AuthorNUID    string      `json:"author_nuid" gorm:"not null"`
	Body          string      `json:"body" gorm:"not null"`
	CreatedAt     time.Time   `json:"created_at" gorm:"not null;default:now()"`
	UpdatedAt     time.Time   `json:"updated_at" gorm:"not null;default:now()"`
	Application   Application `json:"-" gorm:"foreignKey:ApplicationID;references:ID;constraint:OnDelete:CASCADE"`
	Author        User        `json:"-" gorm:"foreignKey:AuthorNUID;references:NUID"`
}

// InterviewCommentDetail bundles a comment with the author's resolved display
// name (not a table column).
type InterviewCommentDetail struct {
	InterviewComment
	AuthorName string `json:"author_name,omitempty"`
}

// LeadSelection: a lead marking an application as wanted for their team.
type LeadSelection struct {
	ID            string      `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	CycleID       string      `json:"cycle_id" gorm:"type:uuid;not null;index:idx_lead_selections_cycle_lead,priority:1;uniqueIndex:tl_selections_cycle_id_tl_nuid_application_id_key,priority:1"`
	LeadNUID      string      `json:"lead_nuid" gorm:"not null;index:idx_lead_selections_cycle_lead,priority:2;uniqueIndex:tl_selections_cycle_id_tl_nuid_application_id_key,priority:2"`
	ApplicationID string      `json:"application_id" gorm:"type:uuid;not null;index:idx_lead_selections_app;uniqueIndex:tl_selections_cycle_id_tl_nuid_application_id_key,priority:3"`
	Note          *string     `json:"note,omitempty"`
	CreatedAt     time.Time   `json:"created_at" gorm:"not null;default:now()"`
	UpdatedAt     time.Time   `json:"updated_at" gorm:"not null;default:now()"`
	Cycle         Cycle       `json:"-" gorm:"foreignKey:CycleID;references:ID"`
	Lead          User        `json:"-" gorm:"foreignKey:LeadNUID;references:NUID"`
	Application   Application `json:"-" gorm:"foreignKey:ApplicationID;references:ID;constraint:OnDelete:CASCADE"`
}

type ReviewRelease struct {
	CycleID         string     `json:"cycle_id" gorm:"primaryKey;type:uuid"`
	ApplicationRole Role       `json:"application_role" gorm:"primaryKey;type:application_role"`
	ReviewKind      ReviewKind `json:"review_kind" gorm:"primaryKey;type:text;check:review_releases_review_kind_check,review_kind IN ('written','recording')"`
	ReleasedBy      string     `json:"released_by" gorm:"not null"`
	ReleasedAt      time.Time  `json:"released_at" gorm:"not null;default:now()"`
	Cycle           Cycle      `json:"-" gorm:"foreignKey:CycleID;references:ID;constraint:OnDelete:CASCADE"`
	Releaser        User       `json:"-" gorm:"foreignKey:ReleasedBy;references:NUID"`
}
