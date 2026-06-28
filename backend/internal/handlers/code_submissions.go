package handlers

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

type codeSubmissionHandler struct {
	store *store.Store
}

func (h *codeSubmissionHandler) register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "upsert-code-submission",
		Method:      http.MethodPut,
		Path:        "/applications/{id}/code-submission",
		Summary:     "Submit or update the challenge link",
		Description: "Records the submission URL. Scores are populated externally (deferred).",
		Tags:        []string{"Code submissions"},
	}, h.upsert)

	huma.Register(api, huma.Operation{
		OperationID: "list-code-submissions",
		Method:      http.MethodGet,
		Path:        "/applications/{id}/code-submission",
		Summary:     "List an application's code submissions",
		Tags:        []string{"Code submissions"},
	}, h.list)
}

type CodeSubmissionOutput struct {
	Body models.CodeSubmission
}

type CodeSubmissionsOutput struct {
	Body []models.CodeSubmission
}

type UpsertCodeSubmissionInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		ChallengeID   string `json:"challenge_id"`
		SubmissionURL string `json:"submission_url"`
	}
}

func (h *codeSubmissionHandler) upsert(ctx context.Context, in *UpsertCodeSubmissionInput) (*CodeSubmissionOutput, error) {
	sub, err := h.store.UpsertCodeSubmission(ctx, in.ID, in.Body.ChallengeID, in.Body.SubmissionURL)
	if err != nil {
		return nil, storeErr(err)
	}
	return &CodeSubmissionOutput{Body: sub}, nil
}

type CodeSubmissionAppInput struct {
	ID string `path:"id" doc:"Application ID"`
}

func (h *codeSubmissionHandler) list(ctx context.Context, in *CodeSubmissionAppInput) (*CodeSubmissionsOutput, error) {
	subs, err := h.store.ListCodeSubmissions(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	return &CodeSubmissionsOutput{Body: subs}, nil
}
