package codesubmission

import (
	"context"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type CodeSubmissionDB struct {
	db *gorm.DB
}

func NewCodeSubmissionDB(db *gorm.DB) *CodeSubmissionDB {
	return &CodeSubmissionDB{db: db}
}

// StageForChallenge is the application's stage when the challenge belongs to its cycle and role.
func (c *CodeSubmissionDB) StageForChallenge(ctx context.Context, applicationID, challengeID string) (models.ApplicationStage, bool, error) {
	var stages []models.ApplicationStage
	err := c.db.WithContext(ctx).Table("applications a").Select("a.stage").
		Joins("JOIN code_challenges ch ON ch.id = ? AND ch.cycle_id = a.cycle_id AND ch.role_id = a.role_id", challengeID).
		Where("a.id = ?", applicationID).Pluck("a.stage", &stages).Error
	if err != nil || len(stages) == 0 {
		return "", false, err
	}
	return stages[0], true, nil
}

// UpsertCodeSubmission records or replaces the link for an application's
// challenge. Scores are filled in externally and left alone here.
func (c *CodeSubmissionDB) UpsertCodeSubmission(ctx context.Context, applicationID, challengeID, submissionURL string) (models.CodeSubmission, error) {
	submission := models.CodeSubmission{
		ApplicationID: applicationID,
		ChallengeID:   challengeID,
		SubmissionURL: submissionURL,
	}
	err := c.db.WithContext(ctx).
		Select("application_id", "challenge_id", "submission_url").
		Clauses(
			clause.OnConflict{
				Columns: []clause.Column{{Name: "application_id"}, {Name: "challenge_id"}},
				DoUpdates: clause.Set{
					{Column: clause.Column{Name: "submission_url"}, Value: clause.Column{Table: "excluded", Name: "submission_url"}},
					{Column: clause.Column{Name: "submitted_at"}, Value: gorm.Expr("NOW()")},
				},
			},
			clause.Returning{},
		).
		Create(&submission).Error
	return submission, utils.DBErr(err)
}

func (c *CodeSubmissionDB) ListCodeSubmissions(ctx context.Context, applicationID string) ([]models.CodeSubmission, error) {
	submissions := []models.CodeSubmission{}
	err := c.db.WithContext(ctx).Where("application_id = ?", applicationID).Order("submitted_at").Find(&submissions).Error
	return submissions, err
}
