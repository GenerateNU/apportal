package application

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/access"
)

type answerService struct {
	access        *access.Checker
	applicationDB *ApplicationDB
}

func (s *answerService) listBulk(ctx context.Context, in *ListAnswersBulkInput) (*AnswersOutput, error) {
	if err := access.RequireActor(ctx); err != nil {
		return nil, err
	}
	ids := utils.SplitIDs(in.ApplicationIDs)
	if len(ids) == 0 {
		return &AnswersOutput{Body: []models.WrittenAnswer{}}, nil
	}
	if len(ids) > utils.MaxBulkApplications {
		return nil, huma.Error422UnprocessableEntity("too many application_ids")
	}
	ids, err := s.access.VisibleApplicationIDs(ctx, ids, access.Review)
	if err != nil {
		return nil, err
	}
	answers, err := s.applicationDB.ListAnswersForApplications(ctx, ids)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &AnswersOutput{Body: answers}, nil
}

func (s *answerService) upsert(ctx context.Context, in *UpsertAnswersInput) (*AnswersOutput, error) {
	actor, hasActor := middleware.ActorFrom(ctx)
	if !hasActor || actor.NUID == "" {
		return nil, huma.Error401Unauthorized("authentication required")
	}

	app, err := s.applicationDB.GetApplication(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
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

	inputs := make([]AnswerInput, 0, len(in.Body.Answers))
	for _, a := range in.Body.Answers {
		if a.QuestionID == "" {
			return nil, huma.Error422UnprocessableEntity("each answer requires a question_id")
		}
		inputs = append(inputs, AnswerInput{
			QuestionID:     a.QuestionID,
			AnswerText:     a.AnswerText,
			AnswerOptions:  a.AnswerOptions,
			AnswerFilePath: a.AnswerFilePath,
			AnswerFileName: a.AnswerFileName,
		})
	}

	answers, err := s.applicationDB.UpsertAnswers(ctx, in.ID, inputs)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &AnswersOutput{Body: answers}, nil
}

func (s *answerService) list(ctx context.Context, in *ListAnswersInput) (*AnswersOutput, error) {
	if err := access.RequireActor(ctx); err != nil {
		return nil, err
	}
	app, err := s.applicationDB.GetApplication(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if err := requireViewable(ctx, s.access, app); err != nil {
		return nil, err
	}

	answers, err := s.applicationDB.ListAnswers(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &AnswersOutput{Body: answers}, nil
}
