package reviewquestion

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"
)

type reviewQuestionService struct {
	reviewQuestionDB *ReviewQuestionDB
}

func (s *reviewQuestionService) list(ctx context.Context, in *ListReviewQuestionsInput) (*ReviewQuestionsOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	var role *models.Role
	if in.Role != "" {
		parsed := models.Role(in.Role)
		if !parsed.Valid() {
			return nil, huma.Error422UnprocessableEntity("invalid role")
		}
		role = &parsed
	}

	questions, err := s.reviewQuestionDB.ListReviewQuestions(ctx, in.ID, role)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &ReviewQuestionsOutput{Body: questions}, nil
}

func (s *reviewQuestionService) create(ctx context.Context, in *CreateReviewQuestionInput) (*ReviewQuestionOutput, error) {
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
	required := true
	if in.Body.IsRequired != nil {
		required = *in.Body.IsRequired
	}

	q, err := s.reviewQuestionDB.CreateReviewQuestion(ctx, ReviewQuestionCreate{
		CycleID:      in.ID,
		Role:         in.Body.Role,
		QuestionText: in.Body.QuestionText,
		QuestionType: qType,
		IsRequired:   required,
		DisplayOrder: in.Body.DisplayOrder,
		Options:      in.Body.Options,
		Description:  in.Body.Description,
	})
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &ReviewQuestionOutput{Body: q}, nil
}

func (s *reviewQuestionService) update(ctx context.Context, in *UpdateReviewQuestionInput) (*ReviewQuestionOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if in.Body.QuestionType != nil && !in.Body.QuestionType.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid question_type")
	}

	q, err := s.reviewQuestionDB.UpdateReviewQuestion(ctx, in.ID, ReviewQuestionUpdate{
		QuestionText:     in.Body.QuestionText,
		QuestionType:     in.Body.QuestionType,
		IsRequired:       in.Body.IsRequired,
		DisplayOrder:     in.Body.DisplayOrder,
		Options:          in.Body.Options,
		Description:      in.Body.Description,
		ClearDescription: in.Body.ClearDescription,
	})
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &ReviewQuestionOutput{Body: q}, nil
}

func (s *reviewQuestionService) delete(ctx context.Context, in *DeleteReviewQuestionInput) (*struct{}, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if err := s.reviewQuestionDB.DeleteReviewQuestion(ctx, in.ID); err != nil {
		return nil, utils.StoreErr(err)
	}
	return nil, nil
}
