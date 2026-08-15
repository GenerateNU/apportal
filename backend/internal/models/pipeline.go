package models

import (
	"encoding/json"
	"time"
)

// Structs for the review → interview → selection pipeline. Field order matches
// each table's column order so pgx.RowToStructByPos maps them correctly.

// LeadAssignment: a chief assigns a lead to write-review an application. A cycle
// stage's required_assignments (3 for lead_review) gates advancement.
type LeadAssignment struct {
	ID            string    `json:"id"`
	ApplicationID string    `json:"application_id"`
	LeadNUID      string    `json:"lead_nuid"`
	AssignedBy    string    `json:"assigned_by"`
	AssignedAt    time.Time `json:"assigned_at"`
}

// WrittenReview: a lead's review of an application. The rubric itself (what
// questions get answered) is dynamic — see ReviewQuestion/WrittenReviewAnswer.
type WrittenReview struct {
	ID            string     `json:"id"`
	ApplicationID string     `json:"application_id"`
	ReviewerNUID  string     `json:"reviewer_nuid"`
	SubmittedAt   *time.Time `json:"submitted_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

// ReviewQuestion: a chief-defined rubric question for lead written reviews,
// scoped to a cycle and (optionally) a specific role — same shape as
// Question, minus PageTitle (review forms are short; no multi-page need)
// and plus Description.
type ReviewQuestion struct {
	ID           string          `json:"id"`
	CycleID      string          `json:"cycle_id"`
	Role         *Role           `json:"role,omitempty"`
	QuestionText string          `json:"question_text"`
	QuestionType QuestionType    `json:"question_type"`
	IsRequired   bool            `json:"is_required"`
	DisplayOrder int             `json:"display_order"`
	Options      json.RawMessage `json:"options,omitempty"`
	Description  *string         `json:"description,omitempty"`
	CreatedAt    time.Time       `json:"created_at"`
}

// WrittenReviewAnswer: a reviewer's answer to one ReviewQuestion within a
// written review — replaces the old fixed overall_score/reasoning columns.
type WrittenReviewAnswer struct {
	ID               string          `json:"id"`
	ReviewID         string          `json:"review_id"`
	ReviewQuestionID string          `json:"review_question_id"`
	AnswerText       *string         `json:"answer_text,omitempty"`
	AnswerOptions    json.RawMessage `json:"answer_options,omitempty"`
	Score            *int            `json:"score,omitempty"`
	SubmittedAt      time.Time       `json:"submitted_at"`
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
	ID            string     `json:"id"`
	ApplicationID string     `json:"application_id"`
	ReviewerNUID  string     `json:"reviewer_nuid"`
	Vote          *ChiefVote `json:"vote,omitempty"`
	DecidedAt     *time.Time `json:"decided_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
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
	ID            string    `json:"id"`
	ApplicationID string    `json:"application_id"`
	AuthorNUID    string    `json:"author_nuid"`
	Body          string    `json:"body"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// ChiefReviewCommentDetail bundles a comment with the author's resolved
// display name (not a table column).
type ChiefReviewCommentDetail struct {
	ChiefReviewComment
	AuthorName string `json:"author_name,omitempty"`
}

// InterviewAssignment: the single interviewer assigned to an application.
type InterviewAssignment struct {
	ID              string    `json:"id"`
	ApplicationID   string    `json:"application_id"`
	AssignedBy      string    `json:"assigned_by"`
	InterviewerNUID string    `json:"interviewer_nuid"`
	AssignedAt      time.Time `json:"assigned_at"`
}

// InterviewReviewAssignment: a lead assigned to review the interview recording.
type InterviewReviewAssignment struct {
	ID            string    `json:"id"`
	ApplicationID string    `json:"application_id"`
	LeadNUID      string    `json:"lead_nuid"`
	AssignedBy    string    `json:"assigned_by"`
	AssignedAt    time.Time `json:"assigned_at"`
}

// Interview: filled out by the interviewer after conducting the interview.
type Interview struct {
	ID              string     `json:"id"`
	ApplicationID   string     `json:"application_id"`
	InterviewerNUID string     `json:"interviewer_nuid"`
	ScheduledAt     *time.Time `json:"scheduled_at,omitempty"`
	ConductedAt     *time.Time `json:"conducted_at,omitempty"`
	RecordingURL    *string    `json:"recording_url,omitempty"`
	// NotesURL links to the interviewer's notes doc (e.g. a Granola summary),
	// alongside RecordingURL.
	NotesURL    *string          `json:"notes_url,omitempty"`
	Comments    *string          `json:"comments,omitempty"`
	Rating      *InterviewRating `json:"rating,omitempty"`
	SubmittedAt *time.Time       `json:"submitted_at,omitempty"`
	CreatedAt   time.Time        `json:"created_at"`
	UpdatedAt   time.Time        `json:"updated_at"`
}

// InterviewRecordingReview: an assigned lead's review of an interview recording.
type InterviewRecordingReview struct {
	ID           string           `json:"id"`
	InterviewID  string           `json:"interview_id"`
	ReviewerNUID string           `json:"reviewer_nuid"`
	Comments     *string          `json:"comments,omitempty"`
	Rating       *InterviewRating `json:"rating,omitempty"`
	SubmittedAt  *time.Time       `json:"submitted_at,omitempty"`
	CreatedAt    time.Time        `json:"created_at"`
	UpdatedAt    time.Time        `json:"updated_at"`
}

// InterviewComment is an open comment on an application's interview, visible
// to and postable by any reviewer — unlike ChiefReviewComment, not restricted
// to chiefs, since interview calibration is meant to be a shared discussion.
type InterviewComment struct {
	ID            string    `json:"id"`
	ApplicationID string    `json:"application_id"`
	AuthorNUID    string    `json:"author_nuid"`
	Body          string    `json:"body"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// InterviewCommentDetail bundles a comment with the author's resolved display
// name (not a table column).
type InterviewCommentDetail struct {
	InterviewComment
	AuthorName string `json:"author_name,omitempty"`
}

// LeadSelection: a lead marking an application as wanted for their team.
type LeadSelection struct {
	ID            string    `json:"id"`
	CycleID       string    `json:"cycle_id"`
	LeadNUID      string    `json:"lead_nuid"`
	ApplicationID string    `json:"application_id"`
	Note          *string   `json:"note,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}
