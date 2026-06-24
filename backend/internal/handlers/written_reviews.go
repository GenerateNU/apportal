package handlers

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

type writtenReviewHandler struct {
	store *store.Store
}

func (h *writtenReviewHandler) register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "upsert-written-review",
		Method:      http.MethodPut,
		Path:        "/applications/{id}/written-review",
		Summary:     "Submit or update your written review",
		Description: "Reviewer only; upserts the calling reviewer's review and per-answer scores.",
		Tags:        []string{"Written reviews"},
		Errors:      []int{http.StatusUnauthorized},
	}, h.upsert)

	huma.Register(api, huma.Operation{
		OperationID: "list-written-reviews",
		Method:      http.MethodGet,
		Path:        "/applications/{id}/written-reviews",
		Summary:     "List an application's written reviews",
		Tags:        []string{"Written reviews"},
		Errors:      []int{http.StatusUnauthorized},
	}, h.list)
}

type WrittenReviewOutput struct {
	Body models.WrittenReviewDetail
}

type WrittenReviewsOutput struct {
	Body []models.WrittenReviewDetail
}

// AnswerScoreSubmission is one per-answer score within a written review.
type AnswerScoreSubmission struct {
	AnswerID string  `json:"answer_id"`
	Score    *int    `json:"score,omitempty" minimum:"1" maximum:"10"`
	Comment  *string `json:"comment,omitempty"`
}

type UpsertWrittenReviewInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		OverallScore *int                    `json:"overall_score,omitempty" minimum:"1" maximum:"10"`
		Reasoning    *string                 `json:"reasoning,omitempty"`
		Submit       bool                    `json:"submit,omitempty" doc:"When true, marks the review as submitted"`
		AnswerScores []AnswerScoreSubmission `json:"answer_scores,omitempty"`
	}
}

func (h *writtenReviewHandler) upsert(ctx context.Context, in *UpsertWrittenReviewInput) (*WrittenReviewOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	scores := make([]store.AnswerScoreInput, 0, len(in.Body.AnswerScores))
	for _, sc := range in.Body.AnswerScores {
		if sc.AnswerID == "" {
			return nil, huma.Error422UnprocessableEntity("each answer score requires an answer_id")
		}
		scores = append(scores, store.AnswerScoreInput{
			AnswerID: sc.AnswerID,
			Score:    sc.Score,
			Comment:  sc.Comment,
		})
	}

	detail, err := h.store.UpsertWrittenReview(ctx, store.WrittenReviewUpsert{
		ApplicationID: in.ID,
		ReviewerNUID:  currentActor(ctx).NUID,
		OverallScore:  in.Body.OverallScore,
		Reasoning:     in.Body.Reasoning,
		Submit:        in.Body.Submit,
		AnswerScores:  scores,
	})
	if err != nil {
		return nil, storeErr(err)
	}
	return &WrittenReviewOutput{Body: detail}, nil
}

func (h *writtenReviewHandler) list(ctx context.Context, in *ApplicationScopedInput) (*WrittenReviewsOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	items, err := h.store.ListWrittenReviews(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	return &WrittenReviewsOutput{Body: items}, nil
}
