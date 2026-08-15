package models

import (
	"encoding/json"
	"time"
)

// InterviewScript is the single, global interview script chiefs edit via the
// portal — no per-cycle scoping, just one row (see the migration's
// singleton-row trick). Questions/ChallengeTracks/PostInterviewChecklist are
// JSONB and pass through as json.RawMessage like every other JSONB field in
// this codebase; the frontend pins their real shape.
type InterviewScript struct {
	IntroSpeech            string          `json:"intro_speech"`
	RecordingReminder      string          `json:"recording_reminder"`
	Questions              json.RawMessage `json:"questions"`
	ClosingNote            string          `json:"closing_note"`
	ChallengeIntro         string          `json:"challenge_intro"`
	ChallengeTracks        json.RawMessage `json:"challenge_tracks"`
	AvailabilityReminder   string          `json:"availability_reminder"`
	PostInterviewChecklist json.RawMessage `json:"post_interview_checklist"`
	UpdatedAt              time.Time       `json:"updated_at"`
	UpdatedBy              *string         `json:"updated_by,omitempty"`
}
