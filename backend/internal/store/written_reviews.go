package store

import (
	"context"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

// AnswerScoreInput is one per-answer score in a written review.
type AnswerScoreInput struct {
	AnswerID string
	Score    *int
	Comment  *string
}

// WrittenReviewUpsert carries a reviewer's full written review for an application.
type WrittenReviewUpsert struct {
	ApplicationID string
	ReviewerNUID  string
	OverallScore  *int
	Reasoning     *string
	Submit        bool // when true, stamps submitted_at = NOW()
	AnswerScores  []AnswerScoreInput
}

const writtenReviewColumns = `id, application_id, reviewer_nuid, overall_score, reasoning, submitted_at, created_at, updated_at`
const answerScoreColumns = `id, review_id, answer_id, score, comment`

// UpsertWrittenReview upserts the reviewer's review (keyed on application +
// reviewer) and its per-answer scores in one transaction, returning the result.
func (s *Store) UpsertWrittenReview(ctx context.Context, in WrittenReviewUpsert) (models.WrittenReviewDetail, error) {
	var detail models.WrittenReviewDetail

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return detail, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	const upsertReview = `
		INSERT INTO written_reviews (application_id, reviewer_nuid, overall_score, reasoning, submitted_at)
		VALUES ($1, $2, $3, $4, CASE WHEN $5 THEN NOW() ELSE NULL END)
		ON CONFLICT (application_id, reviewer_nuid) DO UPDATE SET
			overall_score = EXCLUDED.overall_score,
			reasoning     = EXCLUDED.reasoning,
			submitted_at  = CASE WHEN $5 THEN NOW() ELSE written_reviews.submitted_at END,
			updated_at    = NOW()
		RETURNING ` + writtenReviewColumns
	rows, err := tx.Query(ctx, upsertReview, in.ApplicationID, in.ReviewerNUID,
		in.OverallScore, in.Reasoning, in.Submit)
	if err != nil {
		return detail, err
	}
	review, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.WrittenReview])
	if err != nil {
		return detail, err
	}

	const upsertScore = `
		INSERT INTO written_review_answer_scores (review_id, answer_id, score, comment)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (review_id, answer_id) DO UPDATE SET
			score   = EXCLUDED.score,
			comment = EXCLUDED.comment`
	for _, sc := range in.AnswerScores {
		if _, err := tx.Exec(ctx, upsertScore, review.ID, sc.AnswerID, sc.Score, sc.Comment); err != nil {
			return detail, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return detail, err
	}

	scores, err := s.listAnswerScores(ctx, []string{review.ID})
	if err != nil {
		return detail, err
	}
	detail.WrittenReview = review
	detail.AnswerScores = scores[review.ID]
	if detail.AnswerScores == nil {
		detail.AnswerScores = []models.WrittenReviewAnswerScore{}
	}
	return detail, nil
}

// ListWrittenReviews returns every reviewer's review for an application, each
// with its per-answer scores nested in.
func (s *Store) ListWrittenReviews(ctx context.Context, applicationID string) ([]models.WrittenReviewDetail, error) {
	const q = `SELECT ` + writtenReviewColumns + ` FROM written_reviews WHERE application_id = $1 ORDER BY created_at`
	rows, err := s.db.Query(ctx, q, applicationID)
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
	scores, err := s.listAnswerScores(ctx, ids)
	if err != nil {
		return nil, err
	}

	details := make([]models.WrittenReviewDetail, len(reviews))
	for i, r := range reviews {
		details[i].WrittenReview = r
		details[i].AnswerScores = scores[r.ID]
		if details[i].AnswerScores == nil {
			details[i].AnswerScores = []models.WrittenReviewAnswerScore{}
		}
	}
	return details, nil
}

// listAnswerScores fetches the answer scores for the given review IDs, grouped
// by review_id.
func (s *Store) listAnswerScores(ctx context.Context, reviewIDs []string) (map[string][]models.WrittenReviewAnswerScore, error) {
	grouped := map[string][]models.WrittenReviewAnswerScore{}
	if len(reviewIDs) == 0 {
		return grouped, nil
	}
	const q = `SELECT ` + answerScoreColumns + ` FROM written_review_answer_scores WHERE review_id = ANY($1)`
	rows, err := s.db.Query(ctx, q, reviewIDs)
	if err != nil {
		return nil, err
	}
	scores, err := pgx.CollectRows(rows, pgx.RowToStructByPos[models.WrittenReviewAnswerScore])
	if err != nil {
		return nil, err
	}
	for _, sc := range scores {
		grouped[sc.ReviewID] = append(grouped[sc.ReviewID], sc)
	}
	return grouped, nil
}
