package models

import (
	"encoding/json"
	"time"
)

// InterviewScript is a chief-edited interview script scoped to one
// (cycle, role) pair, like ApplicationTemplate — chiefs run a separate
// interview process per cycle/role and want a different script for each.
// Questions/ChallengeTracks/PostInterviewChecklist are JSONB and pass
// through as json.RawMessage like every other JSONB field in this codebase;
// the frontend pins their real shape.
type InterviewScript struct {
	ID                     string          `json:"id"`
	CycleID                string          `json:"cycle_id"`
	ApplicationRole        Role            `json:"application_role"`
	IntroSpeech            string          `json:"intro_speech"`
	RecordingReminder      string          `json:"recording_reminder"`
	Questions              json.RawMessage `json:"questions"`
	ClosingNote            string          `json:"closing_note"`
	ChallengeIntro         string          `json:"challenge_intro"`
	ChallengeTracks        json.RawMessage `json:"challenge_tracks"`
	PostInterviewChecklist json.RawMessage `json:"post_interview_checklist"`
	CreatedAt              time.Time       `json:"created_at"`
	UpdatedAt              time.Time       `json:"updated_at"`
	UpdatedBy              *string         `json:"updated_by,omitempty"`
}
