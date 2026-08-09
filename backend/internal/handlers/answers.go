package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
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
		Description: "Bulk upsert keyed on (application, question). Owner-only, and only while the application is still a draft.",
		Tags:        []string{"Answers"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, h.upsert)

	huma.Register(api, huma.Operation{
		OperationID: "list-answers",
		Method:      http.MethodGet,
		Path:        "/applications/{id}/answers",
		Summary:     "List an application's written answers",
		Tags:        []string{"Answers"},
		Errors:      []int{http.StatusNotFound},
	}, h.list)
}

type AnswersOutput struct {
	Body []models.WrittenAnswer
}

type UpsertAnswersInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		Answers []struct {
			QuestionID     string          `json:"question_id"`
			AnswerText     *string         `json:"answer_text,omitempty"`
			AnswerOptions  json.RawMessage `json:"answer_options,omitempty"`
			AnswerFilePath *string         `json:"answer_file_path,omitempty"`
			AnswerFileName *string         `json:"answer_file_name,omitempty"`
		} `json:"answers" minItems:"1"`
	}
}

func (h *answerHandler) upsert(ctx context.Context, in *UpsertAnswersInput) (*AnswersOutput, error) {
	actor, hasActor := middleware.ActorFrom(ctx)
	if !hasActor || actor.NUID == "" {
		return nil, huma.Error401Unauthorized("authentication required")
	}

	app, err := h.store.GetApplication(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	if actor.NUID != app.UserNUID {
		return nil, huma.Error403Forbidden("cannot edit another applicant's answers")
	}
	// Once submitted, answers are frozen — otherwise a stale autosave from a
	// second tab/session (whose local form state predates the submit) can
	// silently overwrite or delete already-submitted answers, since a bulk
	// upsert always writes every question including ones the stale session
	// never saw filled in.
	if app.Stage != models.StageDraft {
		return nil, huma.Error403Forbidden("answers can only be edited while the application is a draft")
	}

	inputs := make([]store.AnswerInput, 0, len(in.Body.Answers))
	for _, a := range in.Body.Answers {
		if a.QuestionID == "" {
			return nil, huma.Error422UnprocessableEntity("each answer requires a question_id")
		}
		inputs = append(inputs, store.AnswerInput{
			QuestionID:     a.QuestionID,
			AnswerText:     a.AnswerText,
			AnswerOptions:  a.AnswerOptions,
			AnswerFilePath: a.AnswerFilePath,
			AnswerFileName: a.AnswerFileName,
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
	app, err := h.store.GetApplication(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	// A draft's answers are private autosave content — only its owner can
	// list them. Mirrors get-application: reject the same way as a missing
	// row so a guessed/shared draft ID can't be distinguished from one that
	// doesn't exist.
	if app.Stage == models.StageDraft {
		actor, hasActor := middleware.ActorFrom(ctx)
		if !hasActor || actor.NUID != app.UserNUID {
			return nil, huma.Error404NotFound("not found")
		}
	}

	answers, err := h.store.ListAnswers(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	return &AnswersOutput{Body: answers}, nil
}
