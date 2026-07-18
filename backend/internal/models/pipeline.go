package models

import "time"

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

// WrittenReview: a lead's 1–10 score and reasoning for an application.
type WrittenReview struct {
	ID            string     `json:"id"`
	ApplicationID string     `json:"application_id"`
	ReviewerNUID  string     `json:"reviewer_nuid"`
	OverallScore  *int       `json:"overall_score,omitempty"`
	Reasoning     *string    `json:"reasoning,omitempty"`
	SubmittedAt   *time.Time `json:"submitted_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

// WrittenReviewAnswerScore: a per-answer score within a written review.
type WrittenReviewAnswerScore struct {
	ID       string  `json:"id"`
	ReviewID string  `json:"review_id"`
	AnswerID string  `json:"answer_id"`
	Score    *int    `json:"score,omitempty"`
	Comment  *string `json:"comment,omitempty"`
}

// WrittenReviewDetail bundles a review with its per-answer scores (not a table).
type WrittenReviewDetail struct {
	WrittenReview
	AnswerScores []WrittenReviewAnswerScore `json:"answer_scores"`
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

// ChiefReview: a chief's advance/hold decision after the lead written reviews.
type ChiefReview struct {
	ID                 string     `json:"id"`
	ApplicationID      string     `json:"application_id"`
	ReviewerNUID       string     `json:"reviewer_nuid"`
	Notes              *string    `json:"notes,omitempty"`
	AdvanceToInterview *bool      `json:"advance_to_interview,omitempty"`
	DecidedAt          *time.Time `json:"decided_at,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
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
	ID              string           `json:"id"`
	ApplicationID   string           `json:"application_id"`
	InterviewerNUID string           `json:"interviewer_nuid"`
	ScheduledAt     *time.Time       `json:"scheduled_at,omitempty"`
	ConductedAt     *time.Time       `json:"conducted_at,omitempty"`
	RecordingURL    *string          `json:"recording_url,omitempty"`
	Notes           *string          `json:"notes,omitempty"`
	Comments        *string          `json:"comments,omitempty"`
	Rating          *InterviewRating `json:"rating,omitempty"`
	SubmittedAt     *time.Time       `json:"submitted_at,omitempty"`
	CreatedAt       time.Time        `json:"created_at"`
	UpdatedAt       time.Time        `json:"updated_at"`
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
