package decision

import "github.com/GenerateNU/apportal/backend/internal/models"

type DecisionTemplatesOutput struct {
	Body []models.DecisionTemplate
}

type DecisionTemplateOutput struct {
	Body models.DecisionTemplate
}

type DecisionsOutput struct {
	Body []models.DecisionRow
}

type DecisionOutput struct {
	Body models.DecisionRow
}

type ListDecisionTemplatesInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Role string `query:"role" doc:"Applicant role"`
}

type UpdateDecisionTemplateInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Role string `query:"role" doc:"Applicant role"`
	Kind string `query:"kind" doc:"Which letter" enum:"rejection_post_interview,rejection_generic"`
	Body struct {
		Subject string `json:"subject" minLength:"1"`
		Body    string `json:"body" minLength:"1"`
	}
}

type ListDecisionsInput struct {
	ID              string `path:"id" doc:"Cycle ID"`
	Role            string `query:"role" doc:"Applicant role; omit for both"`
	Kind            string `query:"kind" doc:"Which letter applies" enum:"rejection_post_interview,rejection_generic"`
	InterviewerNUID string `query:"interviewer_nuid" doc:"Limit to applicants this reviewer interviewed — a lead's own feedback queue"`
	Search          string `query:"search" doc:"Case-insensitive substring match on the applicant's name, NUID, or email"`
}

type UpsertDecisionInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		Feedback    *string `json:"feedback,omitempty" doc:"The \"to shed some light\" paragraph. Empty string clears it."`
		Compliments *string `json:"compliments,omitempty" doc:"The \"I really loved talking to you about\" paragraph. Empty string clears it."`
		// The three below are chief-only; a lead sending any of them is
		// rejected rather than silently ignored.
		Kind         *models.DecisionKind `json:"kind,omitempty" doc:"Chief only. Overrides which letter applies."`
		BodyOverride *string              `json:"body_override,omitempty" doc:"Chief only. Replaces the rendered message wholesale. Empty string reverts to the template."`
		MarkSent     *bool                `json:"mark_sent,omitempty" doc:"Chief only. Records that the message was emailed, and moves the applicant to the rejected stage with it. Setting it false restores the stage they were in before."`
	}
}

type DecisionContextOutput struct {
	Body []models.DecisionContext
}

type ListDecisionContextInput struct {
	// Comma-separated rather than a repeated/array param because huma splits
	// this form itself, while the browser client serializes arrays as
	// `application_ids[]=…`, which binds to nothing server-side.
	ApplicationIDs string `query:"application_ids" doc:"Comma-separated application IDs"`
}

// DecisionTemplateUpdate replaces one letter; chiefs edit it as one form.
type DecisionTemplateUpdate struct {
	Subject   string
	Body      string
	UpdatedBy string
}

// DecisionFilter narrows the decisions list. CycleID is always set; the rest
// come from the page's filter row.
type DecisionFilter struct {
	CycleID string
	Role    *models.Role
	Kind    *models.DecisionKind
	// InterviewerNUID scopes a lead's queue to applicants they interviewed.
	InterviewerNUID string
	Search          string
	// ApplicationIDs backs the context endpoint's "which may this caller see".
	ApplicationIDs []string
}

// DecisionDraftUpdate is a partial write: nil leaves a field alone and "" clears
// it. Kind is always supplied because the column is NOT NULL.
type DecisionDraftUpdate struct {
	Kind         models.DecisionKind
	Feedback     *string
	Compliments  *string
	BodyOverride *string
	AuthorNUID   string
	// MarkSent stamps or clears sent_at/sent_by and rejects or un-rejects the
	// applicant with it. Nil leaves both alone.
	MarkSent *bool
	SentBy   string
	// PreviousStage is filled in by UpsertDecisionDraft, not by callers.
	PreviousStage *models.ApplicationStage
}
