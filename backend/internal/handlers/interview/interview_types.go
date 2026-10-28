package interview

import (
	"time"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type InterviewOutput struct {
	Body models.Interview
}

type InterviewsOutput struct {
	Body []models.Interview
}

type ListInterviewsBulkInput struct {
	// Comma-separated rather than a repeated/array param because huma splits
	// this form itself, while the browser client serializes arrays as
	// `application_ids[]=…`, which binds to nothing server-side.
	ApplicationIDs string `query:"application_ids" doc:"Comma-separated application IDs"`
}

type UpsertInterviewInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		ScheduledAt  *time.Time              `json:"scheduled_at,omitempty"`
		ConductedAt  *time.Time              `json:"conducted_at,omitempty"`
		RecordingURL *string                 `json:"recording_url,omitempty"`
		NotesURL     *string                 `json:"notes_url,omitempty"`
		Comments     *string                 `json:"comments,omitempty"`
		Rating       *models.InterviewRating `json:"rating,omitempty"`
		Submit       bool                    `json:"submit,omitempty" doc:"When true, marks the interview as submitted"`
	}
}
