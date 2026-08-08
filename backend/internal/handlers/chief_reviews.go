package handlers

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

type chiefReviewHandler struct {
	store *store.Store
}

func (h *chiefReviewHandler) register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "upsert-chief-review",
		Method:      http.MethodPut,
		Path:        "/applications/{id}/chief-review",
		Summary:     "Submit or update your chief review",
		Description: "Chief only. Setting vote records this chief's vote.",
		Tags:        []string{"Chief reviews"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden},
	}, h.upsert)

	huma.Register(api, huma.Operation{
		OperationID: "list-chief-reviews",
		Method:      http.MethodGet,
		Path:        "/applications/{id}/chief-reviews",
		Summary:     "List an application's chief reviews",
		Tags:        []string{"Chief reviews"},
		Errors:      []int{http.StatusUnauthorized},
	}, h.list)
}

type ChiefReviewOutput struct {
	Body models.ChiefReviewDetail
}

type ChiefReviewsOutput struct {
	Body []models.ChiefReviewDetail
}

type UpsertChiefReviewInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		Notes *string           `json:"notes,omitempty"`
		Vote  *models.ChiefVote `json:"vote,omitempty"`
	}
}

func (h *chiefReviewHandler) upsert(ctx context.Context, in *UpsertChiefReviewInput) (*ChiefReviewOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if in.Body.Vote != nil && !in.Body.Vote.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid vote")
	}
	review, err := h.store.UpsertChiefReview(ctx, store.ChiefReviewUpsert{
		ApplicationID: in.ID,
		ReviewerNUID:  currentActor(ctx).NUID,
		Notes:         in.Body.Notes,
		Vote:          in.Body.Vote,
	})
	if err != nil {
		return nil, storeErr(err)
	}
	return &ChiefReviewOutput{Body: review}, nil
}

func (h *chiefReviewHandler) list(ctx context.Context, in *ApplicationScopedInput) (*ChiefReviewsOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	items, err := h.store.ListChiefReviews(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	return &ChiefReviewsOutput{Body: items}, nil
}
