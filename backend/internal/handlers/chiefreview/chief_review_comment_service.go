package chiefreview

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
)

type chiefReviewCommentService struct {
	access        *access.Checker
	chiefReviewDB *ChiefReviewDB
	workflow      *workflow.Service
}

func (s *chiefReviewCommentService) list(ctx context.Context, in *utils.ApplicationScopedInput) (*ChiefReviewCommentsOutput, error) {
	r, err := s.access.CanRead(ctx, in.ID, access.ManageApplication, access.Manage, workflow.WorkChiefReview)
	if err != nil {
		return nil, err
	}
	if !r.Has(in.ID) {
		return &ChiefReviewCommentsOutput{Body: []models.ChiefReviewCommentDetail{}}, nil
	}
	items, err := s.chiefReviewDB.ListChiefReviewComments(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &ChiefReviewCommentsOutput{Body: items}, nil
}

func (s *chiefReviewCommentService) create(ctx context.Context, in *CreateChiefReviewCommentInput) (*ChiefReviewCommentOutput, error) {
	if err := s.access.CanApplication(ctx, access.ManageApplication, in.ID); err != nil {
		return nil, err
	}
	if err := s.workflow.RequireWorkEditable(ctx, in.ID, workflow.WorkChiefReview); err != nil {
		return nil, err
	}
	comment, err := s.chiefReviewDB.CreateChiefReviewComment(ctx, in.ID, utils.CurrentActor(ctx).NUID, in.Body.Body)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &ChiefReviewCommentOutput{Body: comment}, nil
}

func (s *chiefReviewCommentService) update(ctx context.Context, in *UpdateChiefReviewCommentInput) (*ChiefReviewCommentOutput, error) {
	if err := s.access.CanApplication(ctx, access.ManageApplication, in.ID); err != nil {
		return nil, err
	}
	if err := s.workflow.RequireWorkEditable(ctx, in.ID, workflow.WorkChiefReview); err != nil {
		return nil, err
	}
	comment, err := s.chiefReviewDB.UpdateChiefReviewComment(ctx, in.CommentID, utils.CurrentActor(ctx).NUID, in.Body.Body)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &ChiefReviewCommentOutput{Body: comment}, nil
}
