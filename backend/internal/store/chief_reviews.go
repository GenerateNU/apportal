package store

import (
	"context"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

// ChiefReviewUpsert carries a chief's review of an application.
type ChiefReviewUpsert struct {
	ApplicationID string
	ReviewerNUID  string
	Notes         *string
	Vote          *models.ChiefVote // non-nil marks the vote as cast (stamps decided_at)
}

const chiefReviewColumns = `id, application_id, reviewer_nuid, notes, vote, decided_at, created_at, updated_at`

// UpsertChiefReview upserts the chief's review, keyed on application + reviewer.
// decided_at is stamped whenever a vote is provided.
func (s *Store) UpsertChiefReview(ctx context.Context, in ChiefReviewUpsert) (models.ChiefReviewDetail, error) {
	var detail models.ChiefReviewDetail
	const q = `
		INSERT INTO chief_reviews (application_id, reviewer_nuid, notes, vote, decided_at)
		VALUES ($1, $2, $3, $4, CASE WHEN $4::text IS NOT NULL THEN NOW() ELSE NULL END)
		ON CONFLICT (application_id, reviewer_nuid) DO UPDATE SET
			notes      = EXCLUDED.notes,
			vote       = EXCLUDED.vote,
			decided_at = CASE WHEN $4::text IS NOT NULL THEN NOW() ELSE chief_reviews.decided_at END,
			updated_at = NOW()
		RETURNING ` + chiefReviewColumns
	rows, err := s.db.Query(ctx, q, in.ApplicationID, in.ReviewerNUID, in.Notes, in.Vote)
	if err != nil {
		return detail, err
	}
	review, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.ChiefReview])
	if err != nil {
		return detail, err
	}
	names, err := s.namesByNUIDs(ctx, []string{review.ReviewerNUID})
	if err != nil {
		return detail, err
	}
	detail.ChiefReview = review
	detail.ReviewerName = names[review.ReviewerNUID]
	return detail, nil
}

func (s *Store) ListChiefReviews(ctx context.Context, applicationID string) ([]models.ChiefReviewDetail, error) {
	const q = `SELECT ` + chiefReviewColumns + ` FROM chief_reviews WHERE application_id = $1 ORDER BY created_at`
	rows, err := s.db.Query(ctx, q, applicationID)
	if err != nil {
		return nil, err
	}
	reviews, err := pgx.CollectRows(rows, pgx.RowToStructByPos[models.ChiefReview])
	if err != nil {
		return nil, err
	}

	nuids := make([]string, len(reviews))
	for i, r := range reviews {
		nuids[i] = r.ReviewerNUID
	}
	names, err := s.namesByNUIDs(ctx, nuids)
	if err != nil {
		return nil, err
	}

	details := make([]models.ChiefReviewDetail, len(reviews))
	for i, r := range reviews {
		details[i].ChiefReview = r
		details[i].ReviewerName = names[r.ReviewerNUID]
	}
	return details, nil
}
