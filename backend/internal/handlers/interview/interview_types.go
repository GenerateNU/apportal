package interview

import (
	"encoding/json"
	"time"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type InterviewOutput struct {
	Body models.InterviewDetail
}

type InterviewsOutput struct {
	Body []models.InterviewDetail
}

type ListInterviewsBulkInput struct {
	ApplicationIDs string `query:"application_ids" doc:"Comma-separated application IDs"`
}

type UpsertInterviewInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		ScheduledAt  *time.Time              `json:"scheduled_at,omitempty"`
		ConductedAt  *time.Time              `json:"conducted_at,omitempty"`
		RecordingURL *string                 `json:"recording_url,omitempty"`
		NotesURL     *string                 `json:"notes_url,omitempty"`
		Rating       *models.InterviewRating `json:"rating,omitempty"`
		Writeup      *string                 `json:"writeup,omitempty"`
		Submit       bool                    `json:"submit,omitempty" doc:"When true, submits your write-up"`
	}
}

type InterviewUpsert struct {
	ApplicationID   string
	InterviewerNUID string
	ScheduledAt     *time.Time
	ConductedAt     *time.Time
	RecordingURL    *string
	NotesURL        *string
	Rating          *models.InterviewRating
	Writeup         *string
	Submit          bool
}

// InterviewScriptUpdate replaces a whole (cycle, role) script; chiefs edit it
// as one form.
type InterviewScriptUpdate struct {
	IntroSpeech            string
	RecordingReminder      string
	Questions              json.RawMessage
	ClosingNote            string
	ChallengeIntro         string
	ChallengeTracks        json.RawMessage
	PostInterviewChecklist json.RawMessage
	UpdatedBy              string
}
