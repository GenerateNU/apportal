package codesubmission

import (
	"context"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
)

type codeSubmissionService struct {
	access           *access.Checker
	workflow         *workflow.Service
	codeSubmissionDB *CodeSubmissionDB
}

func (s *codeSubmissionService) upsert(ctx context.Context, in *UpsertCodeSubmissionInput) (*CodeSubmissionOutput, error) {
	if err := s.access.CanApplication(ctx, access.EditOwnApplication, in.ID); err != nil {
		return nil, err
	}
	stage, ok, err := s.codeSubmissionDB.StageForChallenge(ctx, in.ID, in.Body.ChallengeID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if !ok {
		return nil, huma.Error422UnprocessableEntity("that challenge isn't part of this application")
	}
	if stage != models.StageDraft {
		return nil, huma.Error403Forbidden("submissions can only change while the application is a draft")
	}
	if err := s.workflow.RequireWorkEditable(ctx, in.ID, workflow.WorkApplication); err != nil {
		return nil, err
	}
	sub, err := s.codeSubmissionDB.UpsertCodeSubmission(ctx, in.ID, in.Body.ChallengeID, in.Body.SubmissionURL)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &CodeSubmissionOutput{Body: sub}, nil
}

func (s *codeSubmissionService) list(ctx context.Context, in *CodeSubmissionAppInput) (*CodeSubmissionsOutput, error) {
	if err := s.access.CanApplication(ctx, access.ViewApplication, in.ID); err != nil {
		return nil, err
	}
	subs, err := s.codeSubmissionDB.ListCodeSubmissions(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &CodeSubmissionsOutput{Body: subs}, nil
}
