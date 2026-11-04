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
