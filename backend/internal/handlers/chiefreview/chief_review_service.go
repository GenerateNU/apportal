package chiefreview

import (
	"context"
	"strings"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"
)

type chiefReviewService struct {
	chiefReviewDB *ChiefReviewDB
}

func (s *chiefReviewService) listBulk(ctx context.Context, in *ListChiefReviewsBulkInput) (*ChiefReviewsOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	ids := make([]string, 0, 8)
	for _, id := range strings.Split(in.ApplicationIDs, ",") {
		if id = strings.TrimSpace(id); id != "" {
			ids = append(ids, id)
		}
	}
	if len(ids) == 0 {
		return &ChiefReviewsOutput{Body: []models.ChiefReviewDetail{}}, nil
	}
	if len(ids) > utils.MaxBulkApplications {
		return nil, huma.Error422UnprocessableEntity("too many application_ids")
	}
	items, err := s.chiefReviewDB.ListChiefReviewsForApplications(ctx, ids)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &ChiefReviewsOutput{Body: items}, nil
}

func (s *chiefReviewService) upsert(ctx context.Context, in *UpsertChiefReviewInput) (*ChiefReviewOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if in.Body.Vote != nil && !in.Body.Vote.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid vote")
	}
	review, err := s.chiefReviewDB.UpsertChiefReview(ctx, ChiefReviewUpsert{
		ApplicationID: in.ID,
		ReviewerNUID:  utils.CurrentActor(ctx).NUID,
		Vote:          in.Body.Vote,
	})
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &ChiefReviewOutput{Body: review}, nil
}

func (s *chiefReviewService) list(ctx context.Context, in *utils.ApplicationScopedInput) (*ChiefReviewsOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	items, err := s.chiefReviewDB.ListChiefReviews(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &ChiefReviewsOutput{Body: items}, nil
}
