package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

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

	huma.Register(api, huma.Operation{
		OperationID: "list-answers-bulk",
		Method:      http.MethodGet,
		Path:        "/answers",
		Summary:     "List written answers for several applications",
		Description: "One request for a page of applications, instead of one per application. Reviewer-only; draft answers are never included.",
		Tags:        []string{"Answers"},
		Errors:      []int{http.StatusUnauthorized, http.StatusUnprocessableEntity},
	}, h.listBulk)
}

// maxBulkApplications bounds both the query string and the fan-out of the
// underlying `= ANY(...)`. Comfortably above any page size the UI uses.
const maxBulkApplications = 200

type ListAnswersBulkInput struct {
	// Comma-separated rather than a repeated/array param because huma splits
	// this form itself, while the browser client serializes arrays as
	// `application_ids[]=…`, which binds to nothing server-side.
	ApplicationIDs string `query:"application_ids" doc:"Comma-separated application IDs"`
}

func (h *answerHandler) listBulk(ctx context.Context, in *ListAnswersBulkInput) (*AnswersOutput, error) {
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
		return &AnswersOutput{Body: []models.WrittenAnswer{}}, nil
	}
	if len(ids) > maxBulkApplications {
		return nil, huma.Error422UnprocessableEntity("too many application_ids")
	}
	answers, err := h.store.ListAnswersForApplications(ctx, ids)
	if err != nil {
		return nil, storeErr(err)
	}
	return &AnswersOutput{Body: answers}, nil
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
