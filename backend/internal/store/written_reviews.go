package store

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

// ReviewAnswerInput is a reviewer's answer to one of the cycle/role's
// review_questions, within a written review.
type ReviewAnswerInput struct {
	ReviewQuestionID string
	AnswerText       *string
	AnswerOptions    json.RawMessage
	Score            *int
}

// isEmpty mirrors AnswerInput.isEmpty (answers.go): a review answer that's
// been cleared needs to actually delete the old row, not silently no-op —
// otherwise a stale value would reappear next time the review is loaded.
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

// WrittenReviewUpsert carries a reviewer's full written review for an application.
type WrittenReviewUpsert struct {
	ApplicationID string
	ReviewerNUID  string
	Submit        bool // when true, stamps submitted_at = NOW()
	Answers       []ReviewAnswerInput
}

const writtenReviewColumns = `id, application_id, reviewer_nuid, submitted_at, created_at, updated_at`
const writtenReviewAnswerColumns = `id, review_id, review_question_id, answer_text, answer_options, score, submitted_at`

// UpsertWrittenReview upserts the reviewer's review (keyed on application +
// reviewer) and its review-question answers in one transaction, returning the
// result.
func (s *Store) UpsertWrittenReview(ctx context.Context, in WrittenReviewUpsert) (models.WrittenReviewDetail, error) {
	var detail models.WrittenReviewDetail

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return detail, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	const upsertReview = `
		INSERT INTO written_reviews (application_id, reviewer_nuid, submitted_at)
		VALUES ($1, $2, CASE WHEN $3 THEN NOW() ELSE NULL END)
		ON CONFLICT (application_id, reviewer_nuid) DO UPDATE SET
			submitted_at = CASE WHEN $3 THEN NOW() ELSE written_reviews.submitted_at END,
			updated_at   = NOW()
		RETURNING ` + writtenReviewColumns
	rows, err := tx.Query(ctx, upsertReview, in.ApplicationID, in.ReviewerNUID, in.Submit)
	if err != nil {
		return detail, err
	}
	review, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.WrittenReview])
	if err != nil {
		return detail, err
	}

	const upsertReviewAnswer = `
		INSERT INTO written_review_answers (review_id, review_question_id, answer_text, answer_options, score)
		VALUES ($1, $2, $3, $4::jsonb, $5)
		ON CONFLICT (review_id, review_question_id) DO UPDATE SET
			answer_text    = EXCLUDED.answer_text,
			answer_options = EXCLUDED.answer_options,
			score          = EXCLUDED.score,
			submitted_at   = NOW()`
	const deleteReviewAnswer = `DELETE FROM written_review_answers WHERE review_id = $1 AND review_question_id = $2`
	for _, a := range in.Answers {
		if a.isEmpty() {
			if _, err := tx.Exec(ctx, deleteReviewAnswer, review.ID, a.ReviewQuestionID); err != nil {
				return detail, err
			}
			continue
		}
		if _, err := tx.Exec(ctx, upsertReviewAnswer, review.ID, a.ReviewQuestionID,
			a.AnswerText, jsonArg(a.AnswerOptions), a.Score); err != nil {
			return detail, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return detail, err
	}

	answers, err := s.listReviewAnswers(ctx, []string{review.ID})
	if err != nil {
		return detail, err
	}
	detail.WrittenReview = review
	detail.Answers = answers[review.ID]
	if detail.Answers == nil {
		detail.Answers = []models.WrittenReviewAnswer{}
	}
	return detail, nil
}

// ListWrittenReviews returns written reviews for an application, each with its
// review-question answers nested in. When onlyReviewer is non-empty, it
// returns just that reviewer's review (used to enforce blind review before a
// chief releases the application); when empty, it returns every reviewer's
// review.
func (s *Store) ListWrittenReviews(ctx context.Context, applicationID, onlyReviewer string) ([]models.WrittenReviewDetail, error) {
	q := `SELECT ` + writtenReviewColumns + ` FROM written_reviews WHERE application_id = $1`
	args := []any{applicationID}
	if onlyReviewer != "" {
		q += ` AND reviewer_nuid = $2`
		args = append(args, onlyReviewer)
	}
	q += ` ORDER BY created_at`
	rows, err := s.db.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	reviews, err := pgx.CollectRows(rows, pgx.RowToStructByPos[models.WrittenReview])
	if err != nil {
		return nil, err
	}

	ids := make([]string, len(reviews))
	for i, r := range reviews {
		ids[i] = r.ID
	}
	answers, err := s.listReviewAnswers(ctx, ids)
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
	}
	return details, nil
}

// listReviewAnswers fetches the review-question answers for the given review
// IDs, grouped by review_id.
func (s *Store) listReviewAnswers(ctx context.Context, reviewIDs []string) (map[string][]models.WrittenReviewAnswer, error) {
	grouped := map[string][]models.WrittenReviewAnswer{}
	if len(reviewIDs) == 0 {
		return grouped, nil
	}
	const q = `SELECT ` + writtenReviewAnswerColumns + ` FROM written_review_answers WHERE review_id = ANY($1)`
	rows, err := s.db.Query(ctx, q, reviewIDs)
	if err != nil {
		return nil, err
	}
	answers, err := pgx.CollectRows(rows, pgx.RowToStructByPos[models.WrittenReviewAnswer])
	if err != nil {
		return nil, err
	}
	for _, a := range answers {
		grouped[a.ReviewID] = append(grouped[a.ReviewID], a)
	}
	return grouped, nil
}
