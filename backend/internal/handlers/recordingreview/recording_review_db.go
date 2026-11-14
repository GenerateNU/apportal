package recordingreview

import (
	"context"

	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type RecordingReviewDB struct {
	db *gorm.DB
}

func NewRecordingReviewDB(db *gorm.DB) *RecordingReviewDB {
	return &RecordingReviewDB{db: db}
}

func (r *RecordingReviewDB) SaveRecordingReview(ctx context.Context, in RecordingReviewUpsert) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		interviewID := tx.Model(&models.Interview{}).Select("id").Where("application_id = ?", in.ApplicationID)
		if in.Rating != nil {
			if err := tx.Model(&models.Interview{}).Where("application_id = ?", in.ApplicationID).
				UpdateColumn("rating", *in.Rating).Error; err != nil {
				return err
			}
		}
		updates := map[string]any{}
		utils.SetIf(updates, "writeup", in.Writeup)
		if in.Submit {
			updates["writeup_submitted_at"] = gorm.Expr("COALESCE(writeup_submitted_at, NOW())")
		}
		if len(updates) == 0 {
			return nil
		}
		return tx.Model(&models.InterviewReviewer{}).
			Where("reviewer_nuid = ? AND interview_id IN (?)", in.ReviewerNUID, interviewID).
			UpdateColumns(updates).Error
	})
}
