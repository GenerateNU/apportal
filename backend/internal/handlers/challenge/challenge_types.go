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
		Role         models.Role `json:"role"`
		Name         string      `json:"name"`
		ChallengeURL *string     `json:"challenge_url,omitempty"`
		Instructions *string     `json:"instructions,omitempty"`
		DueAt        *time.Time  `json:"due_at,omitempty"`
	}
}

type ListChallengesInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Role string `query:"role" doc:"Optional role filter"`
}

type ChallengeCreate struct {
	CycleID      string
	Role         models.Role
	Name         string
	ChallengeURL *string
	Instructions *string
	DueAt        *time.Time
}
