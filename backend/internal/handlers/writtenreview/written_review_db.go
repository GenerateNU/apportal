package writtenreview

import (
	"context"
	"encoding/json"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/GenerateNU/apportal/backend/internal/handlers/user"
	"github.com/GenerateNU/apportal/backend/internal/models"
)

type WrittenReviewDB struct {
	db    *gorm.DB
	users *user.UserDB
}

func NewWrittenReviewDB(db *gorm.DB) *WrittenReviewDB {
	return &WrittenReviewDB{db: db, users: user.NewUserDB(db)}
}

// isEmpty reports whether the answer was cleared, so its row gets deleted
// rather than coming back on the next load.
func (in ReviewAnswerInput) isEmpty() bool {
	if in.Score != nil {
		return false
	}
	if in.AnswerText != nil && strings.TrimSpace(*in.AnswerText) != "" {
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

// UpsertWrittenReview upserts the review, keyed on application + reviewer, and
// its answers in one transaction.
func (w *WrittenReviewDB) UpsertWrittenReview(ctx context.Context, in WrittenReviewUpsert) (models.WrittenReviewDetail, error) {
	var detail models.WrittenReviewDetail
	review := models.WrittenReview{ApplicationID: in.ApplicationID, ReviewerNUID: in.ReviewerNUID}

	err := w.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		err := tx.Select("application_id", "reviewer_nuid").
			Clauses(
				clause.OnConflict{
					Columns:   []clause.Column{{Name: "application_id"}, {Name: "reviewer_nuid"}},
					DoUpdates: clause.Set{{Column: clause.Column{Name: "updated_at"}, Value: gorm.Expr("NOW()")}},
				},
				clause.Returning{},
			).
			Create(&review).Error
		if err != nil {
			return err
		}
		if in.Submit {
			err := tx.Model(&review).Clauses(clause.Returning{}).UpdateColumn("submitted_at", gorm.Expr("NOW()")).Error
			if err != nil {
				return err
			}
		}

		for _, a := range in.Answers {
			if a.isEmpty() {
				err := tx.Where("review_id = ? AND review_question_id = ?", review.ID, a.ReviewQuestionID).
					Delete(&models.WrittenReviewAnswer{}).Error
				if err != nil {
					return err
				}
				continue
			}
			answer := models.WrittenReviewAnswer{
				ReviewID:         review.ID,
				ReviewQuestionID: a.ReviewQuestionID,
				AnswerText:       a.AnswerText,
				AnswerOptions:    a.AnswerOptions,
				Score:            a.Score,
			}
			err := tx.Select("review_id", "review_question_id", "answer_text", "answer_options", "score").
				Clauses(clause.OnConflict{
					Columns: []clause.Column{{Name: "review_id"}, {Name: "review_question_id"}},
					DoUpdates: append(
						clause.AssignmentColumns([]string{"answer_text", "answer_options", "score"}),
						clause.Assignment{Column: clause.Column{Name: "submitted_at"}, Value: gorm.Expr("NOW()")},
					),
				}).
				Create(&answer).Error
			if err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return detail, err
	}

	answers, err := w.listReviewAnswers(ctx, []string{review.ID})
	if err != nil {
		return detail, err
	}
	names, err := w.users.NamesByNUIDs(ctx, []string{review.ReviewerNUID})
	if err != nil {
		return detail, err
	}
	detail.WrittenReview = review
	detail.Answers = answers[review.ID]
	if detail.Answers == nil {
		detail.Answers = []models.WrittenReviewAnswer{}
	}
	detail.ReviewerName = names[review.ReviewerNUID]
	return detail, nil
}

// ListWrittenReviews returns an application's reviews with their answers. A
// non-empty onlyReviewer returns just that reviewer's, for blind review.
func (w *WrittenReviewDB) ListWrittenReviews(ctx context.Context, applicationID, onlyReviewer string) ([]models.WrittenReviewDetail, error) {
	q := w.db.WithContext(ctx).Where("application_id = ?", applicationID)
	if onlyReviewer != "" {
		q = q.Where("reviewer_nuid = ?", onlyReviewer)
	}
	var reviews []models.WrittenReview
	if err := q.Order("created_at").Find(&reviews).Error; err != nil {
		return nil, err
	}

	ids := make([]string, len(reviews))
	reviewerNUIDs := make([]string, len(reviews))
	for i, r := range reviews {
		ids[i] = r.ID
		reviewerNUIDs[i] = r.ReviewerNUID
	}
	answers, err := w.listReviewAnswers(ctx, ids)
	if err != nil {
		return nil, err
	}
	names, err := w.users.NamesByNUIDs(ctx, reviewerNUIDs)
	if err != nil {
		return nil, err
	}

	details := make([]models.WrittenReviewDetail, len(reviews))
	for i, r := range reviews {
		details[i].WrittenReview = r
		details[i].Answers = answers[r.ID]
		if details[i].Answers == nil {
			details[i].Answers = []models.WrittenReviewAnswer{}
		}
		details[i].ReviewerName = names[r.ReviewerNUID]
	}
	return details, nil
}

// listReviewAnswers fetches the answers for the given reviews, grouped by review.
func (w *WrittenReviewDB) listReviewAnswers(ctx context.Context, reviewIDs []string) (map[string][]models.WrittenReviewAnswer, error) {
	grouped := map[string][]models.WrittenReviewAnswer{}
	if len(reviewIDs) == 0 {
		return grouped, nil
	}
	var answers []models.WrittenReviewAnswer
	if err := w.db.WithContext(ctx).Where("review_id IN ?", reviewIDs).Find(&answers).Error; err != nil {
		return nil, err
	}
	for _, a := range answers {
		grouped[a.ReviewID] = append(grouped[a.ReviewID], a)
	}
	return grouped, nil
}

// ListWrittenReviewsForApplications is ListWrittenReviews for many
// applications, keyed by application. onlyReviewer scopes to one reviewer's
// own reviews, as blind review requires.
func (w *WrittenReviewDB) ListWrittenReviewsForApplications(ctx context.Context, applicationIDs []string, onlyReviewer string) (map[string][]models.WrittenReviewDetail, error) {
	grouped := map[string][]models.WrittenReviewDetail{}
	if len(applicationIDs) == 0 {
		return grouped, nil
	}
	q := w.db.WithContext(ctx).Where("application_id IN ?", applicationIDs)
	if onlyReviewer != "" {
		q = q.Where("reviewer_nuid = ?", onlyReviewer)
	}
	var reviews []models.WrittenReview
	if err := q.Order("application_id").Order("created_at").Find(&reviews).Error; err != nil {
		return nil, err
	}

	ids := make([]string, len(reviews))
	reviewerNUIDs := make([]string, len(reviews))
	for i, r := range reviews {
		ids[i] = r.ID
		reviewerNUIDs[i] = r.ReviewerNUID
	}
	answers, err := w.listReviewAnswers(ctx, ids)
	if err != nil {
		return nil, err
	}
	names, err := w.users.NamesByNUIDs(ctx, reviewerNUIDs)
	if err != nil {
		return nil, err
	}
	for _, r := range reviews {
		detail := models.WrittenReviewDetail{WrittenReview: r, Answers: answers[r.ID], ReviewerName: names[r.ReviewerNUID]}
		if detail.Answers == nil {
			detail.Answers = []models.WrittenReviewAnswer{}
		}
		grouped[r.ApplicationID] = append(grouped[r.ApplicationID], detail)
	}
	return grouped, nil
}
