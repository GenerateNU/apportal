package handlers

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

type chiefReviewCommentHandler struct {
	store *store.Store
}

func (h *chiefReviewCommentHandler) register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "list-chief-review-comments",
		Method:      http.MethodGet,
		Path:        "/applications/{id}/chief-review-comments",
		Summary:     "List an application's chief review comments",
		Tags:        []string{"Chief reviews"},
		Errors:      []int{http.StatusUnauthorized},
	}, h.list)

	huma.Register(api, huma.Operation{
		OperationID: "create-chief-review-comment",
		Method:      http.MethodPost,
		Path:        "/applications/{id}/chief-review-comments",
		Summary:     "Add a chief review comment",
		Description: "Chief only. A chief may leave any number of comments on an application.",
		Tags:        []string{"Chief reviews"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, h.create)

	huma.Register(api, huma.Operation{
		OperationID: "update-chief-review-comment",
		Method:      http.MethodPut,
		Path:        "/applications/{id}/chief-review-comments/{commentId}",
		Summary:     "Edit a chief review comment",
		Description: "Chief only, and only the comment's own author.",
		Tags:        []string{"Chief reviews"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, h.update)
}

type ChiefReviewCommentOutput struct {
	Body models.ChiefReviewCommentDetail
}

type ChiefReviewCommentsOutput struct {
	Body []models.ChiefReviewCommentDetail
}

func (h *chiefReviewCommentHandler) list(ctx context.Context, in *ApplicationScopedInput) (*ChiefReviewCommentsOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	items, err := h.store.ListChiefReviewComments(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	return &ChiefReviewCommentsOutput{Body: items}, nil
}

type CreateChiefReviewCommentInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		Body string `json:"body" minLength:"1"`
	}
}

func (h *chiefReviewCommentHandler) create(ctx context.Context, in *CreateChiefReviewCommentInput) (*ChiefReviewCommentOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	comment, err := h.store.CreateChiefReviewComment(ctx, in.ID, currentActor(ctx).NUID, in.Body.Body)
	if err != nil {
		return nil, storeErr(err)
	}
	return &ChiefReviewCommentOutput{Body: comment}, nil
}

type UpdateChiefReviewCommentInput struct {
	ID        string `path:"id" doc:"Application ID"`
	CommentID string `path:"commentId" doc:"Comment ID"`
	Body      struct {
		Body string `json:"body" minLength:"1"`
	}
}

func (h *chiefReviewCommentHandler) update(ctx context.Context, in *UpdateChiefReviewCommentInput) (*ChiefReviewCommentOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	comment, err := h.store.UpdateChiefReviewComment(ctx, in.CommentID, currentActor(ctx).NUID, in.Body.Body)
	if err != nil {
		return nil, storeErr(err)
	}
	return &ChiefReviewCommentOutput{Body: comment}, nil
}
