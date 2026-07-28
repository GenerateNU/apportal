package handlers

import (
	"context"
	"encoding/json"
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
		Description: "Reviewer only; upserts the calling reviewer's review-question answers.",
		Tags:        []string{"Written reviews"},
		Errors:      []int{http.StatusUnauthorized},
	}, h.upsert)

	huma.Register(api, huma.Operation{
		OperationID: "list-written-reviews",
		Method:      http.MethodGet,
		Path:        "/applications/{id}/written-reviews",
		Summary:     "List an application's written reviews",
		Description: "Leads see only their own review until a chief releases the cycle's written reviews; chiefs and admins always see every review.",
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

// ReviewAnswerSubmission is a reviewer's answer to one of the cycle/role's
// review_questions.
type ReviewAnswerSubmission struct {
	ReviewQuestionID string          `json:"review_question_id"`
	AnswerText       *string         `json:"answer_text,omitempty"`
	AnswerOptions    json.RawMessage `json:"answer_options,omitempty"`
	Score            *int            `json:"score,omitempty" minimum:"1" maximum:"10"`
}

type UpsertWrittenReviewInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		Submit  bool                     `json:"submit,omitempty" doc:"When true, marks the review as submitted"`
		Answers []ReviewAnswerSubmission `json:"answers,omitempty"`
	}
}

func (h *writtenReviewHandler) upsert(ctx context.Context, in *UpsertWrittenReviewInput) (*WrittenReviewOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	answers := make([]store.ReviewAnswerInput, 0, len(in.Body.Answers))
	for _, a := range in.Body.Answers {
		if a.ReviewQuestionID == "" {
			return nil, huma.Error422UnprocessableEntity("each answer requires a review_question_id")
		}
		answers = append(answers, store.ReviewAnswerInput{
			ReviewQuestionID: a.ReviewQuestionID,
			AnswerText:       a.AnswerText,
			AnswerOptions:    a.AnswerOptions,
			Score:            a.Score,
		})
	}

	detail, err := h.store.UpsertWrittenReview(ctx, store.WrittenReviewUpsert{
		ApplicationID: in.ID,
		ReviewerNUID:  currentActor(ctx).NUID,
		Submit:        in.Body.Submit,
		Answers:       answers,
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
	actor := currentActor(ctx)

	// Chiefs and admins always see every review. A plain lead sees only their
	// own until a chief releases the cycle's written reviews (blind review).
	onlyReviewer := ""
	if !actor.HasAnyRole(models.UserRoleChief, models.UserRoleAdmin) {
		released, err := h.store.WrittenReviewsReleased(ctx, in.ID)
		if err != nil {
			return nil, storeErr(err)
		}
		if !released {
			onlyReviewer = actor.NUID
		}
	}

	items, err := h.store.ListWrittenReviews(ctx, in.ID, onlyReviewer)
	if err != nil {
		return nil, storeErr(err)
	}
	return &WrittenReviewsOutput{Body: items}, nil
}
