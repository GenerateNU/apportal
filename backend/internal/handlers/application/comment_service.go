package application

import (
	"context"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type commentService struct {
	access    *access.Checker
	commentDB *CommentDB
}

func (s *commentService) list(ctx context.Context, in *utils.ApplicationScopedInput) (*CommentsOutput, error) {
	if err := s.access.CanApplication(ctx, access.ReviewApplication, in.ID); err != nil {
		return nil, err
	}
	items, err := s.commentDB.List(ctx, []string{in.ID})
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &CommentsOutput{Body: items}, nil
}

func (s *commentService) listBulk(ctx context.Context, in *ListCommentsBulkInput) (*CommentsOutput, error) {
	ids := utils.SplitIDs(in.ApplicationIDs)
	if len(ids) > utils.MaxBulkApplications {
		return nil, huma.Error422UnprocessableEntity("too many application_ids")
	}
	ids, err := s.access.VisibleApplicationIDs(ctx, ids, access.Review)
	if err != nil {
		return nil, err
	}
	items, err := s.commentDB.List(ctx, ids)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &CommentsOutput{Body: items}, nil
}

func (s *commentService) create(ctx context.Context, in *CreateCommentInput) (*CommentOutput, error) {
	if err := s.access.CanApplication(ctx, access.ReviewApplication, in.ID); err != nil {
		return nil, err
	}
	comment, err := s.commentDB.Create(ctx, in.ID, utils.CurrentActor(ctx).NUID, in.Body.Body)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &CommentOutput{Body: comment}, nil
}

func (s *commentService) update(ctx context.Context, in *UpdateCommentInput) (*CommentOutput, error) {
	if err := s.access.CanApplication(ctx, access.ReviewApplication, in.ID); err != nil {
		return nil, err
	}
	comment, err := s.commentDB.Update(ctx, in.ID, in.CommentID, utils.CurrentActor(ctx).NUID, in.Body.Body)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &CommentOutput{Body: comment}, nil
}
