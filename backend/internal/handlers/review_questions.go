package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

type reviewQuestionHandler struct {
	store *store.Store
}

func (h *reviewQuestionHandler) register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "list-cycle-review-questions",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/review-questions",
		Summary:     "List a cycle's review questions",
		Description: "Reviewer only. Optional ?role= returns that role's questions plus global ones.",
		Tags:        []string{"Review questions"},
		Errors:      []int{http.StatusUnauthorized},
	}, h.list)

	huma.Register(api, huma.Operation{
		OperationID:   "create-review-question",
		Method:        http.MethodPost,
		Path:          "/cycles/{id}/review-questions",
		Summary:       "Create a review question",
		Description:   "Chief only.",
		Tags:          []string{"Review questions"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden},
	}, h.create)

	huma.Register(api, huma.Operation{
		OperationID: "update-review-question",
		Method:      http.MethodPatch,
		Path:        "/review-questions/{id}",
		Summary:     "Update a review question",
		Description: "Chief only.",
		Tags:        []string{"Review questions"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, h.update)

	huma.Register(api, huma.Operation{
		OperationID:   "delete-review-question",
		Method:        http.MethodDelete,
		Path:          "/review-questions/{id}",
		Summary:       "Delete a review question",
		Description:   "Chief only.",
		Tags:          []string{"Review questions"},
		DefaultStatus: http.StatusNoContent,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, h.delete)
}

type ReviewQuestionOutput struct {
	Body models.ReviewQuestion
}

type ReviewQuestionsOutput struct {
	Body []models.ReviewQuestion
}

type ListReviewQuestionsInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Role string `query:"role" doc:"Optional role filter"`
}

func (h *reviewQuestionHandler) list(ctx context.Context, in *ListReviewQuestionsInput) (*ReviewQuestionsOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	var role *models.Role
	if in.Role != "" {
		parsed := models.Role(in.Role)
		if !parsed.Valid() {
			return nil, huma.Error422UnprocessableEntity("invalid role")
		}
		role = &parsed
	}

	questions, err := h.store.ListReviewQuestions(ctx, in.ID, role)
	if err != nil {
		return nil, storeErr(err)
	}
	return &ReviewQuestionsOutput{Body: questions}, nil
}

type CreateReviewQuestionInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		Role         *models.Role        `json:"role,omitempty" doc:"Omit for a global question shown for all roles"`
		QuestionText string              `json:"question_text"`
		QuestionType models.QuestionType `json:"question_type,omitempty"`
		IsRequired   *bool               `json:"is_required,omitempty"`
		DisplayOrder int                 `json:"display_order,omitempty"`
		Options      json.RawMessage     `json:"options,omitempty"`
	}
}

func (h *reviewQuestionHandler) create(ctx context.Context, in *CreateReviewQuestionInput) (*ReviewQuestionOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	qType := in.Body.QuestionType
	if qType == "" {
		qType = models.QuestionLongAnswer
	}
	if !qType.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid question_type")
	}
	if in.Body.Role != nil && !in.Body.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid role")
	}
	required := true
	if in.Body.IsRequired != nil {
		required = *in.Body.IsRequired
	}

	q, err := h.store.CreateReviewQuestion(ctx, store.ReviewQuestionCreate{
		CycleID:      in.ID,
		Role:         in.Body.Role,
		QuestionText: in.Body.QuestionText,
		QuestionType: qType,
		IsRequired:   required,
		DisplayOrder: in.Body.DisplayOrder,
		Options:      in.Body.Options,
	})
	if err != nil {
		return nil, storeErr(err)
	}
	return &ReviewQuestionOutput{Body: q}, nil
}

type UpdateReviewQuestionInput struct {
	ID   string `path:"id" doc:"Review question ID"`
	Body struct {
		QuestionText *string              `json:"question_text,omitempty"`
		QuestionType *models.QuestionType `json:"question_type,omitempty"`
		IsRequired   *bool                `json:"is_required,omitempty"`
		DisplayOrder *int                 `json:"display_order,omitempty"`
		Options      json.RawMessage      `json:"options,omitempty"`
	}
}

func (h *reviewQuestionHandler) update(ctx context.Context, in *UpdateReviewQuestionInput) (*ReviewQuestionOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if in.Body.QuestionType != nil && !in.Body.QuestionType.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid question_type")
	}

	q, err := h.store.UpdateReviewQuestion(ctx, in.ID, store.ReviewQuestionUpdate{
		QuestionText: in.Body.QuestionText,
		QuestionType: in.Body.QuestionType,
		IsRequired:   in.Body.IsRequired,
		DisplayOrder: in.Body.DisplayOrder,
		Options:      in.Body.Options,
	})
	if err != nil {
		return nil, storeErr(err)
	}
	return &ReviewQuestionOutput{Body: q}, nil
}

type DeleteReviewQuestionInput struct {
	ID string `path:"id" doc:"Review question ID"`
}

func (h *reviewQuestionHandler) delete(ctx context.Context, in *DeleteReviewQuestionInput) (*struct{}, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if err := h.store.DeleteReviewQuestion(ctx, in.ID); err != nil {
		return nil, storeErr(err)
	}
	return nil, nil
}
