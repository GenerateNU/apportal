package application

import (
	"context"
	"strings"

	"github.com/GenerateNU/apportal/backend/internal/handlers/question"
	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/storage"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
)

// uploadService lets an applicant answer a `url`-type question by uploading a
// PDF instead of typing a link. It never proxies file bytes itself — it only
// mints short-lived signed Storage URLs (after the same ownership checks used
// elsewhere) for the frontend to upload/download directly.
type uploadService struct {
	applicationDB *ApplicationDB
	questionDB    *question.QuestionDB
	storage       *storage.Client
}

func (s *uploadService) createUploadURL(ctx context.Context, in *CreateUploadURLInput) (*CreateUploadURLOutput, error) {
	actor, ok := middleware.ActorFrom(ctx)
	if !ok || actor.NUID == "" {
		return nil, huma.Error401Unauthorized("authentication required")
	}

	app, err := s.applicationDB.GetApplication(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if actor.NUID != app.UserNUID {
		return nil, huma.Error403Forbidden("cannot upload to another applicant's application")
	}

	question, err := s.questionDB.GetQuestion(ctx, in.QuestionID)
	if err != nil {
		return nil, utils.StoreErr(err)
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
	uploadURL, err := s.storage.CreateUploadURL(ctx, path)
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to create upload url", err)
	}

	out := &CreateUploadURLOutput{}
	out.Body.Path = path
	out.Body.UploadURL = uploadURL
	return out, nil
}

func (s *uploadService) createFileURL(ctx context.Context, in *CreateFileURLInput) (*CreateFileURLOutput, error) {
	actor, ok := middleware.ActorFrom(ctx)
	if !ok || actor.NUID == "" {
		return nil, huma.Error401Unauthorized("authentication required")
	}

	app, err := s.applicationDB.GetApplication(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	isOwner := actor.NUID == app.UserNUID
	isReviewer := actor.HasAnyRole(models.UserRoleLead, models.UserRoleChief, models.UserRoleAdmin)
	if !isOwner && !isReviewer {
		return nil, huma.Error403Forbidden("cannot view another applicant's file")
	}

	answer, err := s.applicationDB.GetAnswer(ctx, in.ID, in.QuestionID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if answer.AnswerFilePath == nil || *answer.AnswerFilePath == "" {
		return nil, huma.Error404NotFound("no file uploaded for this answer")
	}

	url, err := s.storage.CreateSignedURL(ctx, *answer.AnswerFilePath)
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to create file url", err)
	}

	out := &CreateFileURLOutput{}
	out.Body.URL = url
	return out, nil
}
