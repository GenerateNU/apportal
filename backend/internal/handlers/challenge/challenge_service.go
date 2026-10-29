package challenge

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"
)

type challengeService struct {
	challengeDB *ChallengeDB
}

func (s *challengeService) create(ctx context.Context, in *CreateChallengeInput) (*ChallengeOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if !in.Body.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("valid role is required")
	}

	challenge, err := s.challengeDB.CreateChallenge(ctx, ChallengeCreate{
		CycleID:      in.ID,
		Role:         in.Body.Role,
		Name:         in.Body.Name,
		ChallengeURL: in.Body.ChallengeURL,
		Instructions: in.Body.Instructions,
		DueAt:        in.Body.DueAt,
	})
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &ChallengeOutput{Body: challenge}, nil
}

func (s *challengeService) list(ctx context.Context, in *ListChallengesInput) (*ChallengesOutput, error) {
	var role *models.Role
	if in.Role != "" {
		parsed := models.Role(in.Role)
		if !parsed.Valid() {
			return nil, huma.Error422UnprocessableEntity("invalid role")
		}
		role = &parsed
	}

	challenges, err := s.challengeDB.ListChallenges(ctx, in.ID, role)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &ChallengesOutput{Body: challenges}, nil
}
