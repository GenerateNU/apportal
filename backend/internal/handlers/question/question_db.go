package question

import (
	"context"

	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type QuestionDB struct {
	db *gorm.DB
}

func NewQuestionDB(db *gorm.DB) *QuestionDB {
	return &QuestionDB{db: db}
}

func (q *QuestionDB) CreateQuestion(ctx context.Context, in QuestionCreate) (models.Question, error) {
	question := models.Question{
		CycleID:      in.CycleID,
		Role:         in.Role,
		QuestionText: in.QuestionText,
		QuestionType: in.QuestionType,
		IsRequired:   in.IsRequired,
		DisplayOrder: in.DisplayOrder,
		Options:      in.Options,
		PageTitle:    in.PageTitle,
	}
	err := utils.Insert(q.db.WithContext(ctx), &question, "cycle_id", "application_role", "question_text",
		"question_type", "is_required", "display_order", "options", "page_title")
	return question, err
}

func (q *QuestionDB) GetQuestion(ctx context.Context, id string) (models.Question, error) {
	var question models.Question
	err := q.db.WithContext(ctx).Where("id = ?", id).Take(&question).Error
	return question, utils.DBErr(err)
}

// ListQuestions returns a cycle's questions in display order. A non-nil role
// narrows to that role's questions plus the global ones.
func (q *QuestionDB) ListQuestions(ctx context.Context, cycleID string, role *models.Role) ([]models.Question, error) {
	query := q.db.WithContext(ctx).Where("cycle_id = ?", cycleID)
	if role != nil {
		query = query.Where("application_role = ? OR application_role IS NULL", *role)
	}
	questions := []models.Question{}
	err := query.Order("display_order").Order("created_at").Find(&questions).Error
	return questions, err
}

func (q *QuestionDB) UpdateQuestion(ctx context.Context, id string, in QuestionUpdate) (models.Question, error) {
	updates := map[string]any{}
	utils.SetIf(updates, "question_text", in.QuestionText)
	utils.SetIf(updates, "question_type", in.QuestionType)
	utils.SetIf(updates, "is_required", in.IsRequired)
	utils.SetIf(updates, "display_order", in.DisplayOrder)
	if len(in.Options) > 0 {
		updates["options"] = models.JSONValue(in.Options)
	}
	if in.ClearPageTitle {
		updates["page_title"] = nil
	} else {
		utils.SetIf(updates, "page_title", in.PageTitle)
	}
	return utils.UpdateReturning[models.Question](q.db.WithContext(ctx), updates, "id = ?", id)
}

func (q *QuestionDB) DeleteQuestion(ctx context.Context, id string) error {
	res := q.db.WithContext(ctx).Where("id = ?", id).Delete(&models.Question{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return utils.ErrNotFound
	}
	return nil
}
