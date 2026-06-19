package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

type answerHandler struct {
	store *store.Store
}

func (h *answerHandler) register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "upsert-answers",
		Method:      http.MethodPut,
		Path:        "/applications/{id}/answers",
		Summary:     "Submit or update written answers",
		Description: "Bulk upsert keyed on (application, question).",
		Tags:        []string{"Answers"},
	}, h.upsert)

	huma.Register(api, huma.Operation{
		OperationID: "list-answers",
		Method:      http.MethodGet,
		Path:        "/applications/{id}/answers",
		Summary:     "List an application's written answers",
		Tags:        []string{"Answers"},
	}, h.list)
}

type AnswersOutput struct {
	Body []models.WrittenAnswer
}

type UpsertAnswersInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		Answers []struct {
			QuestionID    string          `json:"question_id"`
			AnswerText    *string         `json:"answer_text,omitempty"`
			AnswerOptions json.RawMessage `json:"answer_options,omitempty"`
		} `json:"answers" minItems:"1"`
	}
}

func (h *answerHandler) upsert(ctx context.Context, in *UpsertAnswersInput) (*AnswersOutput, error) {
	inputs := make([]store.AnswerInput, 0, len(in.Body.Answers))
	for _, a := range in.Body.Answers {
		if a.QuestionID == "" {
			return nil, huma.Error422UnprocessableEntity("each answer requires a question_id")
		}
		inputs = append(inputs, store.AnswerInput{
			QuestionID:    a.QuestionID,
			AnswerText:    a.AnswerText,
			AnswerOptions: a.AnswerOptions,
		})
	}

	answers, err := h.store.UpsertAnswers(ctx, in.ID, inputs)
	if err != nil {
		return nil, storeErr(err)
	}
	return &AnswersOutput{Body: answers}, nil
}

type ListAnswersInput struct {
	ID string `path:"id" doc:"Application ID"`
}

func (h *answerHandler) list(ctx context.Context, in *ListAnswersInput) (*AnswersOutput, error) {
	answers, err := h.store.ListAnswers(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	return &AnswersOutput{Body: answers}, nil
}
