package reviewquestion

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/handlers/role"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"
)

type reviewQuestionService struct {
	reviewQuestionDB *ReviewQuestionDB
	roleDB           *role.RoleDB
}

func (s *reviewQuestionService) list(ctx context.Context, in *ListReviewQuestionsInput) (*ReviewQuestionsOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	var roleID *string
	if in.RoleID != "" {
		if err := role.ParseRoleID(in.RoleID); err != nil {
			return nil, err
		}
		roleID = &in.RoleID
	}

	questions, err := s.reviewQuestionDB.ListReviewQuestions(ctx, in.ID, roleID)
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
	if in.Body.RoleID != nil {
		if err := role.RequireCycleRole(ctx, s.roleDB, in.ID, *in.Body.RoleID); err != nil {
			return nil, err
		}
	}
	required := true
	if in.Body.IsRequired != nil {
		required = *in.Body.IsRequired
	}

	q, err := s.reviewQuestionDB.CreateReviewQuestion(ctx, ReviewQuestionCreate{
		CycleID:      in.ID,
		RoleID:       in.Body.RoleID,
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
