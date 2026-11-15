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

func (w *WrittenReviewDB) ReviewSubmitted(ctx context.Context, applicationID, reviewerNUID string) (bool, error) {
	var count int64
	err := w.db.WithContext(ctx).Model(&models.WrittenReview{}).
		Where("application_id = ? AND reviewer_nuid = ? AND submitted_at IS NOT NULL", applicationID, reviewerNUID).
		Count(&count).Error
	return count > 0, err
}

func (w *WrittenReviewDB) SubmittedApplications(ctx context.Context, applicationIDs []string, reviewerNUID string) (map[string]bool, error) {
	return applicationSet(w.db.WithContext(ctx).Model(&models.WrittenReview{}).
		Where("application_id IN ? AND reviewer_nuid = ? AND submitted_at IS NOT NULL", applicationIDs, reviewerNUID), applicationIDs)
}

func (w *WrittenReviewDB) AssignedApplications(ctx context.Context, applicationIDs []string, leadNUID string) (map[string]bool, error) {
	return applicationSet(w.db.WithContext(ctx).Model(&models.LeadAssignment{}).
		Where("application_id IN ? AND lead_nuid = ?", applicationIDs, leadNUID), applicationIDs)
}

func applicationSet(q *gorm.DB, applicationIDs []string) (map[string]bool, error) {
	set := map[string]bool{}
	if len(applicationIDs) == 0 {
		return set, nil
	}
	var ids []string
	if err := q.Pluck("application_id", &ids).Error; err != nil {
		return nil, err
	}
	for _, id := range ids {
		set[id] = true
	}
	return set, nil
}

// RequiredReviewQuestionIDs lists the required review questions that apply to
// an application: its cycle's, for its role or for every role.
func (w *WrittenReviewDB) RequiredReviewQuestionIDs(ctx context.Context, applicationID string) ([]string, error) {
	var ids []string
	err := w.db.WithContext(ctx).Table("review_questions q").
		Joins("JOIN applications a ON a.cycle_id = q.cycle_id").
		Where("a.id = ? AND q.is_required AND (q.role_id = a.role_id OR q.role_id IS NULL)", applicationID).
		Pluck("q.id", &ids).Error
	return ids, err
}

func (w *WrittenReviewDB) ReviewQuestionsForApplication(ctx context.Context, applicationID string, questionIDs []string) (map[string]models.ReviewQuestion, error) {
	out := map[string]models.ReviewQuestion{}
	if len(questionIDs) == 0 {
		return out, nil
	}
	var questions []models.ReviewQuestion
	err := w.db.WithContext(ctx).Table("review_questions rq").
		Select("rq.*").
		Joins("JOIN applications a ON a.cycle_id = rq.cycle_id AND (rq.role_id IS NULL OR rq.role_id = a.role_id)").
		Where("a.id = ? AND rq.id IN ?", applicationID, questionIDs).
		Scan(&questions).Error
	if err != nil {
		return nil, err
	}
	for _, q := range questions {
		out[q.ID] = q
	}
	return out, nil
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

// ListWrittenReviewsForApplications returns the reviews, with their answers,
// for many applications, keyed by application.
func (w *WrittenReviewDB) ListWrittenReviewsForApplications(ctx context.Context, applicationIDs []string) (map[string][]models.WrittenReviewDetail, error) {
	grouped := map[string][]models.WrittenReviewDetail{}
	if len(applicationIDs) == 0 {
		return grouped, nil
	}
	q := w.db.WithContext(ctx).Where("application_id IN ?", applicationIDs)
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
