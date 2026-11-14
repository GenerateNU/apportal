package challenge

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/handlers/role"
	"github.com/GenerateNU/apportal/backend/internal/utils"

	"github.com/GenerateNU/apportal/backend/internal/access"
)

type challengeService struct {
	access      *access.Checker
	challengeDB *ChallengeDB
	roleDB      *role.RoleDB
}

func (s *challengeService) create(ctx context.Context, in *CreateChallengeInput) (*ChallengeOutput, error) {
	if err := s.access.CanCycle(ctx, access.ManageCycle, in.ID); err != nil {
		return nil, err
	}
	if err := role.RequireCycleRole(ctx, s.roleDB, in.ID, in.Body.RoleID); err != nil {
		return nil, err
	}

	challenge, err := s.challengeDB.CreateChallenge(ctx, ChallengeCreate{
		CycleID:      in.ID,
		RoleID:       in.Body.RoleID,
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
	var roleID *string
	if in.RoleID != "" {
		if err := role.ParseRoleID(in.RoleID); err != nil {
			return nil, err
		}
		roleID = &in.RoleID
	}
	if err := s.access.RequireForm(ctx, in.ID, in.RoleID); err != nil {
		return nil, err
	}

	challenges, err := s.challengeDB.ListChallenges(ctx, in.ID, roleID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &ChallengesOutput{Body: challenges}, nil
}
