package models

import "time"

// DecisionKind picks which template an applicant's rejection is rendered from.
// Acceptances are handwritten and have no kind.
type DecisionKind string

const (
	// DecisionRejectionPostInterview includes the interviewer's feedback and
	// compliments paragraph.
	DecisionRejectionPostInterview DecisionKind = "rejection_post_interview"
	// DecisionRejectionGeneric is the same letter without that paragraph, for
	// applicants who never interviewed.
	DecisionRejectionGeneric DecisionKind = "rejection_generic"
)

func (k DecisionKind) Valid() bool {
	switch k {
	case DecisionRejectionPostInterview, DecisionRejectionGeneric:
		return true
	}
	return false
}

// DecisionStatus is computed per row, never stored — see the decision_drafts
// migration for why.
type DecisionStatus string

const (
	// DecisionPending is waiting on the interviewer's feedback.
	DecisionPending DecisionStatus = "pending"
	// DecisionReady has everything its template needs and can be copied out.
	DecisionReady DecisionStatus = "ready"
	// DecisionSent was marked sent by hand after someone emailed it.
	DecisionSent DecisionStatus = "sent"
)

// DecisionTemplate is one cycle × role × kind letter. Subject and body both
// carry {{placeholders}}; the frontend's renderDecision fills them in.
type DecisionTemplate struct {
	ID              string       `json:"id"`
	CycleID         string       `json:"cycle_id"`
	ApplicationRole Role         `json:"application_role"`
	Kind            DecisionKind `json:"kind"`
	Subject         string       `json:"subject"`
	Body            string       `json:"body"`
	CreatedAt       time.Time    `json:"created_at"`
	UpdatedAt       time.Time    `json:"updated_at"`
	UpdatedBy       *string      `json:"updated_by,omitempty"`
}

// DecisionRow is one line of the decisions page (not a table): the applicant,
// which letter they get, who owes the feedback, and whatever's been written so
// far. Everything a row renders arrives here, so the page never fetches per
// applicant.
type DecisionRow struct {
	ApplicationID   string           `json:"application_id"`
	CycleID         string           `json:"cycle_id"`
	ApplicationRole Role             `json:"application_role"`
	ApplicantNUID   string           `json:"applicant_nuid"`
	FullName        string           `json:"full_name"`
	Email           string           `json:"email"`
	Stage           ApplicationStage `json:"stage"`
	Kind            DecisionKind     `json:"kind"`
	Status          DecisionStatus   `json:"status"`
	// InterviewerNUID owes the feedback paragraph. Nil for a generic rejection,
	// and for a post-interview one whose assignment has since been deleted.
	InterviewerNUID *string    `json:"interviewer_nuid,omitempty"`
	InterviewerName *string    `json:"interviewer_name,omitempty"`
	Feedback        *string    `json:"feedback,omitempty"`
	Compliments     *string    `json:"compliments,omitempty"`
	BodyOverride    *string    `json:"body_override,omitempty"`
	AuthorNUID      *string    `json:"author_nuid,omitempty"`
	AuthorName      *string    `json:"author_name,omitempty"`
	SentAt          *time.Time `json:"sent_at,omitempty"`
	SentBy          *string    `json:"sent_by,omitempty"`
	UpdatedAt       *time.Time `json:"updated_at,omitempty"`
}

// RecordingReviewDetail bundles a recording review with its reviewer's
// resolved display name (not a table column), the same way
// WrittenReviewDetail does.
type RecordingReviewDetail struct {
	InterviewRecordingReview
	ReviewerName string `json:"reviewer_name,omitempty"`
}

// DecisionContext is the review history behind one applicant's decision — what
// an interviewer draws on to write the feedback paragraph, and what a chief
// reads to sanity-check it. Not a table.
//
// Both Blind flags exist so the UI can say "withheld" rather than showing an
// empty panel that reads as "nobody reviewed them": blind review is still in
// force until a chief releases the cycle × role.
type DecisionContext struct {
	ApplicationID string `json:"application_id"`
	// Interview is the interviewer's own write-up: rating, comments, and the
	// recording/notes links. Nil when the applicant never interviewed.
	Interview             *Interview              `json:"interview,omitempty"`
	RecordingReviews      []RecordingReviewDetail `json:"recording_reviews"`
	WrittenReviews        []WrittenReviewDetail   `json:"written_reviews"`
	WrittenReviewsBlind   bool                    `json:"written_reviews_blind"`
	RecordingReviewsBlind bool                    `json:"recording_reviews_blind"`
}
