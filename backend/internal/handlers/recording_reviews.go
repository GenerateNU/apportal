package handlers

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

type recordingReviewHandler struct {
	store *store.Store
}

func (h *recordingReviewHandler) register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "upsert-recording-review",
		Method:      http.MethodPut,
		Path:        "/interviews/{id}/recording-review",
		Summary:     "Submit or update your interview recording review",
		Description: "Reviewer only; upserts the calling reviewer's review of the recording.",
		Tags:        []string{"Recording reviews"},
		Errors:      []int{http.StatusUnauthorized, http.StatusUnprocessableEntity},
	}, h.upsert)

	huma.Register(api, huma.Operation{
		OperationID: "list-recording-reviews",
		Method:      http.MethodGet,
		Path:        "/interviews/{id}/recording-reviews",
		Summary:     "List an interview's recording reviews",
		Tags:        []string{"Recording reviews"},
		Errors:      []int{http.StatusUnauthorized},
	}, h.list)
}

type RecordingReviewOutput struct {
	Body models.InterviewRecordingReview
}

type RecordingReviewsOutput struct {
	Body []models.InterviewRecordingReview
}

type UpsertRecordingReviewInput struct {
	ID   string `path:"id" doc:"Interview ID"`
	Body struct {
		Comments *string                 `json:"comments,omitempty"`
		Rating   *models.InterviewRating `json:"rating,omitempty"`
		Submit   bool                    `json:"submit,omitempty" doc:"When true, marks the review as submitted"`
	}
}

func (h *recordingReviewHandler) upsert(ctx context.Context, in *UpsertRecordingReviewInput) (*RecordingReviewOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	if in.Body.Rating != nil && !in.Body.Rating.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid rating")
	}
	review, err := h.store.UpsertRecordingReview(ctx, store.RecordingReviewUpsert{
		InterviewID:  in.ID,
		ReviewerNUID: currentActor(ctx).NUID,
		Comments:     in.Body.Comments,
		Rating:       in.Body.Rating,
		Submit:       in.Body.Submit,
	})
	if err != nil {
		return nil, storeErr(err)
	}
	return &RecordingReviewOutput{Body: review}, nil
}

type InterviewScopedInput struct {
	ID string `path:"id" doc:"Interview ID"`
}

func (h *recordingReviewHandler) list(ctx context.Context, in *InterviewScopedInput) (*RecordingReviewsOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	items, err := h.store.ListRecordingReviews(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	return &RecordingReviewsOutput{Body: items}, nil
}
