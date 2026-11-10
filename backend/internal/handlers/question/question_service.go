package question

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"
)

type questionService struct {
	questionDB *QuestionDB
}

func (s *questionService) create(ctx context.Context, in *CreateQuestionInput) (*QuestionOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
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

	q, err := s.questionDB.CreateQuestion(ctx, QuestionCreate{
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
		return nil, utils.StoreErr(err)
	}
	return &QuestionOutput{Body: q}, nil
}

func (s *questionService) list(ctx context.Context, in *ListQuestionsInput) (*QuestionsOutput, error) {
	var role *models.Role
	if in.Role != "" {
		parsed := models.Role(in.Role)
		if !parsed.Valid() {
			return nil, huma.Error422UnprocessableEntity("invalid role")
		}
		role = &parsed
	}

	questions, err := s.questionDB.ListQuestions(ctx, in.ID, role)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &QuestionsOutput{Body: questions}, nil
}

func (s *questionService) update(ctx context.Context, in *UpdateQuestionInput) (*QuestionOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if in.Body.QuestionType != nil && !in.Body.QuestionType.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid question_type")
	}

	q, err := s.questionDB.UpdateQuestion(ctx, in.ID, QuestionUpdate{
		QuestionText:   in.Body.QuestionText,
		QuestionType:   in.Body.QuestionType,
		IsRequired:     in.Body.IsRequired,
		DisplayOrder:   in.Body.DisplayOrder,
		Options:        in.Body.Options,
		PageTitle:      in.Body.PageTitle,
		ClearPageTitle: in.Body.ClearPageTitle,
	})
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &QuestionOutput{Body: q}, nil
}

func (s *questionService) delete(ctx context.Context, in *DeleteQuestionInput) (*struct{}, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if err := s.questionDB.DeleteQuestion(ctx, in.ID); err != nil {
		return nil, utils.StoreErr(err)
	}
	return nil, nil
}
