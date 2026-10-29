package recordingreview

import (
	"context"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/GenerateNU/apportal/backend/internal/handlers/user"
	"github.com/GenerateNU/apportal/backend/internal/models"
)

type RecordingReviewDB struct {
	db    *gorm.DB
	users *user.UserDB
}

func NewRecordingReviewDB(db *gorm.DB) *RecordingReviewDB {
	return &RecordingReviewDB{db: db, users: user.NewUserDB(db)}
}

// UpsertRecordingReview upserts a reviewer's recording review, keyed on
// interview + reviewer. Omitted fields keep their stored value, so a
// comment-only save can't clear an earlier rating.
func (r *RecordingReviewDB) UpsertRecordingReview(ctx context.Context, in RecordingReviewUpsert) (models.InterviewRecordingReview, error) {
	review := models.InterviewRecordingReview{
		InterviewID:  in.InterviewID,
		ReviewerNUID: in.ReviewerNUID,
		Comments:     in.Comments,
		Rating:       in.Rating,
	}
	set := clause.Set{
		{Column: clause.Column{Name: "comments"}, Value: gorm.Expr("COALESCE(EXCLUDED.comments, interview_recording_reviews.comments)")},
		{Column: clause.Column{Name: "rating"}, Value: gorm.Expr("COALESCE(EXCLUDED.rating, interview_recording_reviews.rating)")},
		{Column: clause.Column{Name: "updated_at"}, Value: gorm.Expr("NOW()")},
	}
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		err := tx.Select("interview_id", "reviewer_nuid", "comments", "rating").
			Clauses(
				clause.OnConflict{Columns: []clause.Column{{Name: "interview_id"}, {Name: "reviewer_nuid"}}, DoUpdates: set},
				clause.Returning{},
			).
			Create(&review).Error
		if err != nil || !in.Submit {
			return err
		}
		return tx.Model(&review).Clauses(clause.Returning{}).UpdateColumn("submitted_at", gorm.Expr("NOW()")).Error
	})
	return review, err
}

func (r *RecordingReviewDB) ListRecordingReviews(ctx context.Context, interviewID string) ([]models.InterviewRecordingReview, error) {
	reviews := []models.InterviewRecordingReview{}
	err := r.db.WithContext(ctx).Where("interview_id = ?", interviewID).Order("created_at").Find(&reviews).Error
	return reviews, err
}

// ListRecordingReviewsForInterviews is the batch form of ListRecordingReviews,
// for pages of applications.
func (r *RecordingReviewDB) ListRecordingReviewsForInterviews(ctx context.Context, interviewIDs []string) ([]models.InterviewRecordingReview, error) {
	if len(interviewIDs) == 0 {
		return nil, nil
	}
	reviews := []models.InterviewRecordingReview{}
	err := r.db.WithContext(ctx).Where("interview_id IN ?", interviewIDs).
		Order("interview_id").Order("created_at").Find(&reviews).Error
	return reviews, err
}

// ListRecordingReviewDetailsForInterviews adds reviewer names, keyed by
// interview. Comments are kept; the caller redacts them per the release rules.
func (r *RecordingReviewDB) ListRecordingReviewDetailsForInterviews(ctx context.Context, interviewIDs []string) (map[string][]models.RecordingReviewDetail, error) {
	grouped := map[string][]models.RecordingReviewDetail{}
	if len(interviewIDs) == 0 {
		return grouped, nil
	}
	reviews, err := r.ListRecordingReviewsForInterviews(ctx, interviewIDs)
	if err != nil {
		return nil, err
	}
	reviewerNUIDs := make([]string, len(reviews))
	for i, rv := range reviews {
		reviewerNUIDs[i] = rv.ReviewerNUID
	}
	names, err := r.users.NamesByNUIDs(ctx, reviewerNUIDs)
	if err != nil {
		return nil, err
	}
	for _, rv := range reviews {
		grouped[rv.InterviewID] = append(grouped[rv.InterviewID], models.RecordingReviewDetail{
			InterviewRecordingReview: rv,
			ReviewerName:             names[rv.ReviewerNUID],
		})
	}
	return grouped, nil
}
