package codesubmission

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type codeSubmissionService struct {
	codeSubmissionDB *CodeSubmissionDB
}

func (s *codeSubmissionService) upsert(ctx context.Context, in *UpsertCodeSubmissionInput) (*CodeSubmissionOutput, error) {
	sub, err := s.codeSubmissionDB.UpsertCodeSubmission(ctx, in.ID, in.Body.ChallengeID, in.Body.SubmissionURL)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &CodeSubmissionOutput{Body: sub}, nil
}

func (s *codeSubmissionService) list(ctx context.Context, in *CodeSubmissionAppInput) (*CodeSubmissionsOutput, error) {
	subs, err := s.codeSubmissionDB.ListCodeSubmissions(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &CodeSubmissionsOutput{Body: subs}, nil
}
