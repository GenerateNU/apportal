package chiefreview

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/utils"

	"github.com/GenerateNU/apportal/backend/internal/access"
)

type chiefReviewCommentService struct {
	access        *access.Checker
	chiefReviewDB *ChiefReviewDB
}

func (s *chiefReviewCommentService) list(ctx context.Context, in *utils.ApplicationScopedInput) (*ChiefReviewCommentsOutput, error) {
	if err := s.access.RequireApplication(ctx, in.ID, access.Manage); err != nil {
		return nil, err
	}
	items, err := s.chiefReviewDB.ListChiefReviewComments(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &ChiefReviewCommentsOutput{Body: items}, nil
}

func (s *chiefReviewCommentService) create(ctx context.Context, in *CreateChiefReviewCommentInput) (*ChiefReviewCommentOutput, error) {
	if err := s.access.RequireApplication(ctx, in.ID, access.Manage); err != nil {
		return nil, err
	}
	comment, err := s.chiefReviewDB.CreateChiefReviewComment(ctx, in.ID, utils.CurrentActor(ctx).NUID, in.Body.Body)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &ChiefReviewCommentOutput{Body: comment}, nil
}

func (s *chiefReviewCommentService) update(ctx context.Context, in *UpdateChiefReviewCommentInput) (*ChiefReviewCommentOutput, error) {
	if err := s.access.RequireApplication(ctx, in.ID, access.Manage); err != nil {
		return nil, err
	}
	comment, err := s.chiefReviewDB.UpdateChiefReviewComment(ctx, in.CommentID, utils.CurrentActor(ctx).NUID, in.Body.Body)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &ChiefReviewCommentOutput{Body: comment}, nil
}
