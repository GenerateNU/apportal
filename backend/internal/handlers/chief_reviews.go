package handlers

import (
	"context"
	"net/http"
	"strings"

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

	huma.Register(api, huma.Operation{
		OperationID: "list-chief-reviews-bulk",
		Method:      http.MethodGet,
		Path:        "/chief-reviews",
		Summary:     "List chief reviews for several applications",
		Description: "One request for a page of applications, instead of one per application.",
		Tags:        []string{"Chief reviews"},
		Errors:      []int{http.StatusUnauthorized, http.StatusUnprocessableEntity},
	}, h.listBulk)
}

type ListChiefReviewsBulkInput struct {
	// Comma-separated rather than a repeated/array param because huma splits
	// this form itself, while the browser client serializes arrays as
	// `application_ids[]=…`, which binds to nothing server-side.
	ApplicationIDs string `query:"application_ids" doc:"Comma-separated application IDs"`
}

func (h *chiefReviewHandler) listBulk(ctx context.Context, in *ListChiefReviewsBulkInput) (*ChiefReviewsOutput, error) {
	if err := requireReviewer(ctx); err != nil {
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
	if len(ids) > maxBulkApplications {
		return nil, huma.Error422UnprocessableEntity("too many application_ids")
	}
	items, err := h.store.ListChiefReviewsForApplications(ctx, ids)
	if err != nil {
		return nil, storeErr(err)
	}
	return &ChiefReviewsOutput{Body: items}, nil
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
