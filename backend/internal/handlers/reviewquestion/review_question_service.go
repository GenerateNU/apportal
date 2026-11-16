package reviewquestion

import (
	"context"
	"errors"

	"github.com/GenerateNU/apportal/backend/internal/handlers/role"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
)

type reviewQuestionService struct {
	access           *access.Checker
	reviewQuestionDB *ReviewQuestionDB
	roleDB           *role.RoleDB
	workflow         *workflow.Service
}

func (s *reviewQuestionService) existing(ctx context.Context, id string) error {
	if err := s.access.CanCycleOf(ctx, access.ManageCycle, "review_questions", id); err != nil {
		return err
	}
	q, err := s.reviewQuestionDB.GetReviewQuestion(ctx, id)
	if err != nil {
		return utils.StoreErr(err)
	}
	return s.workflow.RequireSetupEditable(ctx, q.CycleID, utils.Deref(q.RoleID), workflow.SetupReviewRubric)
}

func (s *reviewQuestionService) list(ctx context.Context, in *ListReviewQuestionsInput) (*ReviewQuestionsOutput, error) {
	if err := s.access.CanCycle(ctx, access.ReviewCycle, in.ID); err != nil {
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
	if err := s.access.CanCycle(ctx, access.ManageCycle, in.ID); err != nil {
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
	if err := s.workflow.RequireSetupEditable(ctx, in.ID, utils.Deref(in.Body.RoleID), workflow.SetupReviewRubric); err != nil {
		return nil, err
	}
	required := true
	if in.Body.IsRequired != nil {
		required = *in.Body.IsRequired
	}
	scoreMin, scoreMax, err := resolveScale(qType, in.Body.ScoreMin, in.Body.ScoreMax)
	if err != nil {
		return nil, err
	}
	ranked := true
	if in.Body.Ranked != nil {
		ranked = *in.Body.Ranked
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
		ScoreMin:     scoreMin,
		ScoreMax:     scoreMax,
		Ranked:       ranked,
	})
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &ReviewQuestionOutput{Body: q}, nil
}

func (s *reviewQuestionService) update(ctx context.Context, in *UpdateReviewQuestionInput) (*ReviewQuestionOutput, error) {
	if err := s.existing(ctx, in.ID); err != nil {
		return nil, err
	}
	if in.Body.QuestionType != nil && !in.Body.QuestionType.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid question_type")
	}

	upd := ReviewQuestionUpdate{
		QuestionText:     in.Body.QuestionText,
		QuestionType:     in.Body.QuestionType,
		IsRequired:       in.Body.IsRequired,
		DisplayOrder:     in.Body.DisplayOrder,
		Options:          in.Body.Options,
		Description:      in.Body.Description,
		ClearDescription: in.Body.ClearDescription,
		Ranked:           in.Body.Ranked,
	}
	var scale ScaleResolver
	if in.Body.QuestionType != nil || in.Body.ScoreMin != nil || in.Body.ScoreMax != nil {
		scale = func(cur models.ReviewQuestion) (*int, *int, error) {
			return mergeScale(cur, in.Body.QuestionType, in.Body.ScoreMin, in.Body.ScoreMax)
		}
	}

	q, err := s.reviewQuestionDB.UpdateReviewQuestion(ctx, in.ID, upd, scale)
	var se huma.StatusError
	switch {
	case errors.As(err, &se):
		return nil, err
	case errors.Is(err, ErrScaleLocked):
		return nil, huma.Error409Conflict("this question's scale can't change after reviews have scored it")
	case err != nil:
		return nil, utils.StoreErr(err)
	}
	return &ReviewQuestionOutput{Body: q}, nil
}

func (s *reviewQuestionService) delete(ctx context.Context, in *DeleteReviewQuestionInput) (*struct{}, error) {
	if err := s.existing(ctx, in.ID); err != nil {
		return nil, err
	}
	if err := s.reviewQuestionDB.DeleteReviewQuestion(ctx, in.ID); err != nil {
		return nil, utils.StoreErr(err)
	}
	return nil, nil
}
