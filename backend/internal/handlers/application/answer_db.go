package application

import (
	"context"
	"encoding/json"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

// AnswerInput is one answer in a bulk upsert.
type AnswerInput struct {
	QuestionID     string
	AnswerText     *string
	AnswerOptions  json.RawMessage
	AnswerFilePath *string
	AnswerFileName *string
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
func (a *ApplicationDB) UpsertAnswers(ctx context.Context, applicationID string, inputs []AnswerInput) ([]models.WrittenAnswer, error) {
	err := a.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for _, in := range inputs {
			if in.isEmpty() {
				err := tx.Where("application_id = ? AND question_id = ?", applicationID, in.QuestionID).
					Delete(&models.WrittenAnswer{}).Error
				if err != nil {
					return err
				}
				continue
			}
			answer := models.WrittenAnswer{
				ApplicationID:  applicationID,
				QuestionID:     in.QuestionID,
				AnswerText:     in.AnswerText,
				AnswerOptions:  in.AnswerOptions,
				AnswerFilePath: in.AnswerFilePath,
				AnswerFileName: in.AnswerFileName,
			}
			err := tx.Select("application_id", "question_id", "answer_text", "answer_options", "answer_file_path", "answer_file_name").
				Clauses(clause.OnConflict{
					Columns: []clause.Column{{Name: "application_id"}, {Name: "question_id"}},
					DoUpdates: append(
						clause.AssignmentColumns([]string{"answer_text", "answer_options", "answer_file_path", "answer_file_name"}),
						clause.Assignment{Column: clause.Column{Name: "submitted_at"}, Value: gorm.Expr("NOW()")},
					),
				}).
				Create(&answer).Error
			if err != nil {
				return utils.DBErr(err)
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return a.ListAnswers(ctx, applicationID)
}

// ListAnswersForApplications fetches answers for a page of applications in
// one query. Drafts are private autosaves, and these lists are reviewer-facing,
// so their answers are always excluded.
func (a *ApplicationDB) ListAnswersForApplications(ctx context.Context, applicationIDs []string) ([]models.WrittenAnswer, error) {
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

func (a *ApplicationDB) ListAnswers(ctx context.Context, applicationID string) ([]models.WrittenAnswer, error) {
	answers := []models.WrittenAnswer{}
	err := a.db.WithContext(ctx).Where("application_id = ?", applicationID).Order("submitted_at").Find(&answers).Error
	return answers, err
}

// GetAnswer returns ErrNotFound when the question hasn't been answered.
func (a *ApplicationDB) GetAnswer(ctx context.Context, applicationID, questionID string) (models.WrittenAnswer, error) {
	var answer models.WrittenAnswer
	err := a.db.WithContext(ctx).Where("application_id = ? AND question_id = ?", applicationID, questionID).Take(&answer).Error
	return answer, utils.DBErr(err)
}
