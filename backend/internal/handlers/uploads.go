package handlers

import (
	"context"
	"net/http"
	"strings"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/storage"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

// uploadHandler lets an applicant answer a `url`-type question by uploading a
// PDF instead of typing a link. It never proxies file bytes itself — it only
// mints short-lived signed Storage URLs (after the same ownership checks used
// elsewhere) for the frontend to upload/download directly.
type uploadHandler struct {
	store   *store.Store
	storage *storage.Client
}

func (h *uploadHandler) register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "create-answer-upload-url",
		Method:      http.MethodPost,
		Path:        "/applications/{id}/answers/{questionId}/upload-url",
		Summary:     "Get a signed URL to upload a PDF answer",
		Description: "Only valid for `url`-type questions. The caller PUTs the file to the returned URL, then records answer_file_path/answer_file_name via the answers upsert endpoint.",
		Tags:        []string{"Answers"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, h.createUploadURL)

	huma.Register(api, huma.Operation{
		OperationID: "create-answer-file-url",
		Method:      http.MethodGet,
		Path:        "/applications/{id}/answers/{questionId}/file-url",
		Summary:     "Get a signed URL to view an uploaded PDF answer",
		Tags:        []string{"Answers"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, h.createFileURL)
}

type CreateUploadURLInput struct {
	ID         string `path:"id" doc:"Application ID"`
	QuestionID string `path:"questionId"`
	Body       struct {
		Filename string `json:"filename"`
	}
}

type CreateUploadURLOutput struct {
	Body struct {
		Path      string `json:"path"`
		UploadURL string `json:"upload_url"`
	}
}

func (h *uploadHandler) createUploadURL(ctx context.Context, in *CreateUploadURLInput) (*CreateUploadURLOutput, error) {
	actor, ok := middleware.ActorFrom(ctx)
	if !ok || actor.NUID == "" {
		return nil, huma.Error401Unauthorized("authentication required")
	}

	app, err := h.store.GetApplication(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	if actor.NUID != app.UserNUID {
		return nil, huma.Error403Forbidden("cannot upload to another applicant's application")
	}

	question, err := h.store.GetQuestion(ctx, in.QuestionID)
	if err != nil {
		return nil, storeErr(err)
	}
	if question.CycleID != app.CycleID {
		return nil, huma.Error422UnprocessableEntity("question does not belong to this application's cycle")
	}
	if question.QuestionType != models.QuestionURL {
		return nil, huma.Error422UnprocessableEntity("file uploads are only supported for url questions")
	}
	if !strings.HasSuffix(strings.ToLower(in.Body.Filename), ".pdf") {
		return nil, huma.Error422UnprocessableEntity("only PDF files are supported")
	}

	path := "applications/" + app.ID + "/" + question.ID + "/" + uuid.NewString() + ".pdf"
	uploadURL, err := h.storage.CreateUploadURL(ctx, path)
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to create upload url", err)
	}

	out := &CreateUploadURLOutput{}
	out.Body.Path = path
	out.Body.UploadURL = uploadURL
	return out, nil
}

type CreateFileURLInput struct {
	ID         string `path:"id" doc:"Application ID"`
	QuestionID string `path:"questionId"`
}

type CreateFileURLOutput struct {
	Body struct {
		URL string `json:"url"`
	}
}

func (h *uploadHandler) createFileURL(ctx context.Context, in *CreateFileURLInput) (*CreateFileURLOutput, error) {
	actor, ok := middleware.ActorFrom(ctx)
	if !ok || actor.NUID == "" {
		return nil, huma.Error401Unauthorized("authentication required")
	}

	app, err := h.store.GetApplication(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	isOwner := actor.NUID == app.UserNUID
	isReviewer := actor.HasAnyRole(models.UserRoleLead, models.UserRoleChief, models.UserRoleAdmin)
	if !isOwner && !isReviewer {
		return nil, huma.Error403Forbidden("cannot view another applicant's file")
	}

	answer, err := h.store.GetAnswer(ctx, in.ID, in.QuestionID)
	if err != nil {
		return nil, storeErr(err)
	}
	if answer.AnswerFilePath == nil || *answer.AnswerFilePath == "" {
		return nil, huma.Error404NotFound("no file uploaded for this answer")
	}

	url, err := h.storage.CreateSignedURL(ctx, *answer.AnswerFilePath)
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to create file url", err)
	}

	out := &CreateFileURLOutput{}
	out.Body.URL = url
	return out, nil
}
