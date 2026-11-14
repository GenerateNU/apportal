package challenge

import (
	"time"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type ChallengeOutput struct {
	Body models.CodeChallenge
}

type ChallengesOutput struct {
	Body []models.CodeChallenge
}

type CreateChallengeInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		RoleID       string     `json:"role_id"`
		Name         string     `json:"name"`
		ChallengeURL *string    `json:"challenge_url,omitempty"`
		Instructions *string    `json:"instructions,omitempty"`
		DueAt        *time.Time `json:"due_at,omitempty"`
	}
}

type ListChallengesInput struct {
	ID     string `path:"id" doc:"Cycle ID"`
	RoleID string `query:"role_id" doc:"Optional role filter"`
}

type ChallengeCreate struct {
	CycleID      string
	RoleID       string
	Name         string
	ChallengeURL *string
	Instructions *string
	DueAt        *time.Time
}
