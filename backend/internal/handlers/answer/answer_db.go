package answer

import (
	"context"
	"encoding/json"
	"slices"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type AnswerDB struct {
	db *gorm.DB
}

func NewAnswerDB(db *gorm.DB) *AnswerDB { return &AnswerDB{db: db} }

func (a *AnswerDB) GetApplication(ctx context.Context, id string) (models.Application, error) {
	var app models.Application
	err := a.db.WithContext(ctx).Where("id = ?", id).Take(&app).Error
	return app, utils.DBErr(err)
}

// isEmpty reports whether the answer has no content. Autosave resends the whole
// form, so a cleared field must delete its row or the old value comes back.
func (in AnswerInput) isEmpty() bool {
	if in.AnswerText != nil && strings.TrimSpace(*in.AnswerText) != "" {
		return false
	}
	if in.AnswerFilePath != nil && strings.TrimSpace(*in.AnswerFilePath) != "" {
		return false
	}
	if len(in.AnswerOptions) == 0 {
		return true
	}
	var opts []string
	if err := json.Unmarshal(in.AnswerOptions, &opts); err == nil {
		return len(opts) == 0
	}
	return false
}

// UpsertAnswers writes an application's answers in one transaction, keyed on
// (application_id, question_id), and returns the full current set.
func (a *AnswerDB) UpsertAnswers(ctx context.Context, applicationID string, inputs []AnswerInput) ([]models.WrittenAnswer, error) {
	err := a.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var cleared []string
		answers := make([]models.WrittenAnswer, 0, len(inputs))
		for _, in := range inputs {
			answers = slices.DeleteFunc(answers, func(x models.WrittenAnswer) bool { return x.QuestionID == in.QuestionID })
			if in.isEmpty() {
				cleared = append(cleared, in.QuestionID)
				continue
			}
			answers = append(answers, models.WrittenAnswer{
				ApplicationID:  applicationID,
				QuestionID:     in.QuestionID,
				AnswerText:     in.AnswerText,
				AnswerOptions:  in.AnswerOptions,
				AnswerFilePath: in.AnswerFilePath,
				AnswerFileName: in.AnswerFileName,
			})
		}
		if len(cleared) > 0 {
			if err := tx.Where("application_id = ? AND question_id IN ?", applicationID, cleared).Delete(&models.WrittenAnswer{}).Error; err != nil {
				return err
			}
		}
		if len(answers) == 0 {
			return nil
		}
		err := tx.Select("application_id", "question_id", "answer_text", "answer_options", "answer_file_path", "answer_file_name").
			Clauses(clause.OnConflict{
				Columns: []clause.Column{{Name: "application_id"}, {Name: "question_id"}},
				DoUpdates: append(
					clause.AssignmentColumns([]string{"answer_text", "answer_options", "answer_file_path", "answer_file_name"}),
					clause.Assignment{Column: clause.Column{Name: "submitted_at"}, Value: gorm.Expr("NOW()")},
				),
			}).
			Create(&answers).Error
		return utils.DBErr(err)
	})
	if err != nil {
		return nil, err
	}
	return a.ListAnswers(ctx, applicationID)
}

// ListAnswersForApplications fetches answers for a page of applications in
// one query. Drafts are private autosaves, and these lists are reviewer-facing,
// so their answers are always excluded.
func (a *AnswerDB) ListAnswersForApplications(ctx context.Context, applicationIDs []string) ([]models.WrittenAnswer, error) {
	if len(applicationIDs) == 0 {
		return nil, nil
	}
	answers := []models.WrittenAnswer{}
	err := a.db.WithContext(ctx).Table("written_answers wa").
		Select("wa.*").
		Joins("JOIN applications a ON a.id = wa.application_id").
		Where("wa.application_id IN ? AND a.stage != ?", applicationIDs, models.StageDraft).
		Order("wa.application_id").Order("wa.submitted_at").
		Find(&answers).Error
	return answers, err
}

func (a *AnswerDB) ListAnswers(ctx context.Context, applicationID string) ([]models.WrittenAnswer, error) {
	answers := []models.WrittenAnswer{}
	err := a.db.WithContext(ctx).Where("application_id = ?", applicationID).Order("submitted_at").Find(&answers).Error
	return answers, err
}

// GetAnswer returns ErrNotFound when the question hasn't been answered.
func (a *AnswerDB) GetAnswer(ctx context.Context, applicationID, questionID string) (models.WrittenAnswer, error) {
	var answer models.WrittenAnswer
	err := a.db.WithContext(ctx).Where("application_id = ? AND question_id = ?", applicationID, questionID).Take(&answer).Error
	return answer, utils.DBErr(err)
}
