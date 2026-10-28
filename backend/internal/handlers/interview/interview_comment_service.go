package interview

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type interviewCommentService struct {
	interviewDB *InterviewDB
}

func (s *interviewCommentService) list(ctx context.Context, in *utils.ApplicationScopedInput) (*InterviewCommentsOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	items, err := s.interviewDB.ListInterviewComments(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &InterviewCommentsOutput{Body: items}, nil
}

func (s *interviewCommentService) create(ctx context.Context, in *CreateInterviewCommentInput) (*InterviewCommentOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	comment, err := s.interviewDB.CreateInterviewComment(ctx, in.ID, utils.CurrentActor(ctx).NUID, in.Body.Body)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &InterviewCommentOutput{Body: comment}, nil
}

func (s *interviewCommentService) update(ctx context.Context, in *UpdateInterviewCommentInput) (*InterviewCommentOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	comment, err := s.interviewDB.UpdateInterviewComment(ctx, in.CommentID, utils.CurrentActor(ctx).NUID, in.Body.Body)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &InterviewCommentOutput{Body: comment}, nil
}
