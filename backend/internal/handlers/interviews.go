package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

type interviewHandler struct {
	store *store.Store
}

func (h *interviewHandler) register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "upsert-interview",
		Method:      http.MethodPut,
		Path:        "/applications/{id}/interview",
		Summary:     "Create or update the interview write-up",
		Description: "Reviewer only (the interviewer). Provided fields overwrite; omitted ones are preserved.",
		Tags:        []string{"Interviews"},
		Errors:      []int{http.StatusUnauthorized, http.StatusUnprocessableEntity},
	}, h.upsert)

	huma.Register(api, huma.Operation{
		OperationID: "get-interview",
		Method:      http.MethodGet,
		Path:        "/applications/{id}/interview",
		Summary:     "Get an application's interview",
		Tags:        []string{"Interviews"},
		Errors:      []int{http.StatusUnauthorized, http.StatusNotFound},
	}, h.get)
}

type InterviewOutput struct {
	Body models.Interview
}

type UpsertInterviewInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		ScheduledAt  *time.Time              `json:"scheduled_at,omitempty"`
		ConductedAt  *time.Time              `json:"conducted_at,omitempty"`
		RecordingURL *string                 `json:"recording_url,omitempty"`
		Notes        *string                 `json:"notes,omitempty"`
		Comments     *string                 `json:"comments,omitempty"`
		Rating       *models.InterviewRating `json:"rating,omitempty"`
		Submit       bool                    `json:"submit,omitempty" doc:"When true, marks the interview as submitted"`
	}
}

func (h *interviewHandler) upsert(ctx context.Context, in *UpsertInterviewInput) (*InterviewOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	if in.Body.Rating != nil && !in.Body.Rating.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid rating")
	}
	iv, err := h.store.UpsertInterview(ctx, store.InterviewUpsert{
		ApplicationID:   in.ID,
		InterviewerNUID: currentActor(ctx).NUID,
		ScheduledAt:     in.Body.ScheduledAt,
		ConductedAt:     in.Body.ConductedAt,
		RecordingURL:    in.Body.RecordingURL,
		Notes:           in.Body.Notes,
		Comments:        in.Body.Comments,
		Rating:          in.Body.Rating,
		Submit:          in.Body.Submit,
	})
	if err != nil {
		return nil, storeErr(err)
	}
	return &InterviewOutput{Body: iv}, nil
}

func (h *interviewHandler) get(ctx context.Context, in *ApplicationScopedInput) (*InterviewOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	iv, err := h.store.GetInterview(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	return &InterviewOutput{Body: iv}, nil
}
