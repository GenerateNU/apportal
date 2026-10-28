package interview

import (
	"encoding/json"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type InterviewScriptOutput struct {
	Body models.InterviewScript
}

type GetInterviewScriptInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Role string `query:"role" doc:"Applicant role"`
}

type UpdateInterviewScriptInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Role string `query:"role" doc:"Applicant role"`
	Body struct {
		IntroSpeech            string          `json:"intro_speech" minLength:"1"`
		RecordingReminder      string          `json:"recording_reminder" minLength:"1"`
		Questions              json.RawMessage `json:"questions"`
		ClosingNote            string          `json:"closing_note" minLength:"1"`
		ChallengeIntro         string          `json:"challenge_intro" minLength:"1"`
		ChallengeTracks        json.RawMessage `json:"challenge_tracks"`
		PostInterviewChecklist json.RawMessage `json:"post_interview_checklist"`
	}
}
