package question

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/handlers/role"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
)

type questionService struct {
	access     *access.Checker
	questionDB *QuestionDB
	roleDB     *role.RoleDB
	workflow   *workflow.Service
}

func (s *questionService) existing(ctx context.Context, id string) (models.Question, error) {
	if err := s.access.CanCycleOf(ctx, access.ManageCycle, "questions", id); err != nil {
		return models.Question{}, err
	}
	q, err := s.questionDB.GetQuestion(ctx, id)
	if err != nil {
		return q, utils.StoreErr(err)
	}
	return q, s.workflow.RequireSetupEditable(ctx, q.CycleID, utils.Deref(q.RoleID), workflow.SetupApplicationForm)
}

func (s *questionService) create(ctx context.Context, in *CreateQuestionInput) (*QuestionOutput, error) {
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
	if in.Body.PageTitle != nil && in.Body.RoleID == nil {
		return nil, huma.Error422UnprocessableEntity("only role-specific questions may start a page")
	}
	if err := s.workflow.RequireSetupEditable(ctx, in.ID, utils.Deref(in.Body.RoleID), workflow.SetupApplicationForm); err != nil {
		return nil, err
	}
	required := true
	if in.Body.IsRequired != nil {
		required = *in.Body.IsRequired
	}

	q, err := s.questionDB.CreateQuestion(ctx, QuestionCreate{
		CycleID:      in.ID,
		RoleID:       in.Body.RoleID,
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
	var roleID *string
	if in.RoleID != "" {
		if err := role.ParseRoleID(in.RoleID); err != nil {
			return nil, err
		}
		roleID = &in.RoleID
	}
	if err := s.access.RequireForm(ctx, in.ID, in.RoleID); err != nil {
		return nil, err
	}

	questions, err := s.questionDB.ListQuestions(ctx, in.ID, roleID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &QuestionsOutput{Body: questions}, nil
}

func (s *questionService) update(ctx context.Context, in *UpdateQuestionInput) (*QuestionOutput, error) {
	if in.Body.QuestionType != nil && !in.Body.QuestionType.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid question_type")
	}
	cur, err := s.existing(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	if in.Body.QuestionType != nil && *in.Body.QuestionType != cur.QuestionType {
		answered, err := s.questionDB.Answered(ctx, in.ID)
		if err != nil {
			return nil, utils.StoreErr(err)
		}
		if answered {
			return nil, huma.Error409Conflict("applicants have already answered this question, so its type can't change; add a new question instead")
		}
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
	if _, err := s.existing(ctx, in.ID); err != nil {
		return nil, err
	}
	if err := s.questionDB.DeleteQuestion(ctx, in.ID); err != nil {
		return nil, utils.StoreErr(err)
	}
	return nil, nil
}
