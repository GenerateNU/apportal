package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

type questionHandler struct {
	store *store.Store
}

func (h *questionHandler) register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "list-cycle-questions",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/questions",
		Summary:     "List a cycle's questions",
		Description: "Optional ?role= returns that role's questions plus global ones.",
		Tags:        []string{"Questions"},
	}, h.list)

	huma.Register(api, huma.Operation{
		OperationID:   "create-question",
		Method:        http.MethodPost,
		Path:          "/cycles/{id}/questions",
		Summary:       "Create a question",
		Description:   "Chief only.",
		Tags:          []string{"Questions"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden},
	}, h.create)

	huma.Register(api, huma.Operation{
		OperationID: "update-question",
		Method:      http.MethodPatch,
		Path:        "/questions/{id}",
		Summary:     "Update a question",
		Description: "Chief only.",
		Tags:        []string{"Questions"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, h.update)

	huma.Register(api, huma.Operation{
		OperationID:   "delete-question",
		Method:        http.MethodDelete,
		Path:          "/questions/{id}",
		Summary:       "Delete a question",
		Description:   "Chief only.",
		Tags:          []string{"Questions"},
		DefaultStatus: http.StatusNoContent,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, h.delete)
}

type QuestionOutput struct {
	Body models.Question
}

type QuestionsOutput struct {
	Body []models.Question
}

type CreateQuestionInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		Role         *models.Role        `json:"role,omitempty" doc:"Omit for a global question shown to all roles"`
		QuestionText string              `json:"question_text"`
		QuestionType models.QuestionType `json:"question_type,omitempty"`
		IsRequired   *bool               `json:"is_required,omitempty"`
		DisplayOrder int                 `json:"display_order,omitempty"`
		Options      json.RawMessage     `json:"options,omitempty"`
		PageTitle    *string             `json:"page_title,omitempty" doc:"Set to start a new page at this question. Role-specific questions only."`
	}
}

func (h *questionHandler) create(ctx context.Context, in *CreateQuestionInput) (*QuestionOutput, error) {
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
	if in.Body.PageTitle != nil && in.Body.Role == nil {
		return nil, huma.Error422UnprocessableEntity("only role-specific questions may start a page")
	}
	required := true
	if in.Body.IsRequired != nil {
		required = *in.Body.IsRequired
	}

	q, err := h.store.CreateQuestion(ctx, store.QuestionCreate{
		CycleID:      in.ID,
		Role:         in.Body.Role,
		QuestionText: in.Body.QuestionText,
		QuestionType: qType,
		IsRequired:   required,
		DisplayOrder: in.Body.DisplayOrder,
		Options:      in.Body.Options,
		PageTitle:    in.Body.PageTitle,
	})
	if err != nil {
		return nil, storeErr(err)
	}
	return &QuestionOutput{Body: q}, nil
}

type ListQuestionsInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Role string `query:"role" doc:"Optional role filter"`
}

func (h *questionHandler) list(ctx context.Context, in *ListQuestionsInput) (*QuestionsOutput, error) {
	var role *models.Role
	if in.Role != "" {
		parsed := models.Role(in.Role)
		if !parsed.Valid() {
			return nil, huma.Error422UnprocessableEntity("invalid role")
		}
		role = &parsed
	}

	questions, err := h.store.ListQuestions(ctx, in.ID, role)
	if err != nil {
		return nil, storeErr(err)
	}
	return &QuestionsOutput{Body: questions}, nil
}

type UpdateQuestionInput struct {
	ID   string `path:"id" doc:"Question ID"`
	Body struct {
		QuestionText   *string              `json:"question_text,omitempty"`
		QuestionType   *models.QuestionType `json:"question_type,omitempty"`
		IsRequired     *bool                `json:"is_required,omitempty"`
		DisplayOrder   *int                 `json:"display_order,omitempty"`
		Options        json.RawMessage      `json:"options,omitempty"`
		PageTitle      *string              `json:"page_title,omitempty" doc:"Set to start (or rename) a page at this question"`
		ClearPageTitle bool                 `json:"clear_page_title,omitempty" doc:"Set true to stop this question from starting a page"`
	}
}

func (h *questionHandler) update(ctx context.Context, in *UpdateQuestionInput) (*QuestionOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if in.Body.QuestionType != nil && !in.Body.QuestionType.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid question_type")
	}

	q, err := h.store.UpdateQuestion(ctx, in.ID, store.QuestionUpdate{
		QuestionText:   in.Body.QuestionText,
		QuestionType:   in.Body.QuestionType,
		IsRequired:     in.Body.IsRequired,
		DisplayOrder:   in.Body.DisplayOrder,
		Options:        in.Body.Options,
		PageTitle:      in.Body.PageTitle,
		ClearPageTitle: in.Body.ClearPageTitle,
	})
	if err != nil {
		return nil, storeErr(err)
	}
	return &QuestionOutput{Body: q}, nil
}

type DeleteQuestionInput struct {
	ID string `path:"id" doc:"Question ID"`
}

func (h *questionHandler) delete(ctx context.Context, in *DeleteQuestionInput) (*struct{}, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if err := h.store.DeleteQuestion(ctx, in.ID); err != nil {
		return nil, storeErr(err)
	}
	return nil, nil
}
