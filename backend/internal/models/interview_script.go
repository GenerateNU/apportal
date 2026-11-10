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
	ID                     string          `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	CycleID                string          `json:"cycle_id" gorm:"type:uuid;not null;uniqueIndex:interview_script_cycle_id_application_role_key,priority:1"`
	ApplicationRole        Role            `json:"application_role" gorm:"type:application_role;not null;uniqueIndex:interview_script_cycle_id_application_role_key,priority:2"`
	IntroSpeech            string          `json:"intro_speech" gorm:"not null"`
	RecordingReminder      string          `json:"recording_reminder" gorm:"not null"`
	Questions              json.RawMessage `json:"questions" gorm:"serializer:jsonb;type:jsonb;not null"`
	ClosingNote            string          `json:"closing_note" gorm:"not null"`
	ChallengeIntro         string          `json:"challenge_intro" gorm:"not null"`
	ChallengeTracks        json.RawMessage `json:"challenge_tracks" gorm:"serializer:jsonb;type:jsonb;not null"`
	PostInterviewChecklist json.RawMessage `json:"post_interview_checklist" gorm:"serializer:jsonb;type:jsonb;not null"`
	CreatedAt              time.Time       `json:"created_at" gorm:"not null;default:now()"`
	UpdatedAt              time.Time       `json:"updated_at" gorm:"not null;default:now()"`
	UpdatedBy              *string         `json:"updated_by,omitempty"`
	Cycle                  Cycle           `json:"-" gorm:"foreignKey:CycleID;references:ID;constraint:OnDelete:CASCADE"`
	UpdatedByUser          *User           `json:"-" gorm:"foreignKey:UpdatedBy;references:NUID"`
}

func (InterviewScript) TableName() string { return "interview_script" }
