package interview

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/utils"

	"github.com/GenerateNU/apportal/backend/internal/access"
)

type interviewCommentService struct {
	access      *access.Checker
	interviewDB *InterviewDB
}

func (s *interviewCommentService) list(ctx context.Context, in *utils.ApplicationScopedInput) (*InterviewCommentsOutput, error) {
	if err := s.access.RequireApplication(ctx, in.ID, access.Review); err != nil {
		return nil, err
	}
	items, err := s.interviewDB.ListInterviewComments(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &InterviewCommentsOutput{Body: items}, nil
}

func (s *interviewCommentService) create(ctx context.Context, in *CreateInterviewCommentInput) (*InterviewCommentOutput, error) {
	if err := s.access.RequireApplication(ctx, in.ID, access.Review); err != nil {
		return nil, err
	}
	comment, err := s.interviewDB.CreateInterviewComment(ctx, in.ID, utils.CurrentActor(ctx).NUID, in.Body.Body)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &InterviewCommentOutput{Body: comment}, nil
}

func (s *interviewCommentService) update(ctx context.Context, in *UpdateInterviewCommentInput) (*InterviewCommentOutput, error) {
	if err := s.access.RequireApplication(ctx, in.ID, access.Review); err != nil {
		return nil, err
	}
	comment, err := s.interviewDB.UpdateInterviewComment(ctx, in.CommentID, utils.CurrentActor(ctx).NUID, in.Body.Body)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &InterviewCommentOutput{Body: comment}, nil
}
