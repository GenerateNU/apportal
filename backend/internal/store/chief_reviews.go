package store

import (
	"context"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

// ChiefReviewUpsert carries a chief's vote on an application.
type ChiefReviewUpsert struct {
	ApplicationID string
	ReviewerNUID  string
	Vote          *models.ChiefVote // non-nil marks the vote as cast (stamps decided_at)
}

const chiefReviewColumns = `id, application_id, reviewer_nuid, vote, decided_at, created_at, updated_at`

// UpsertChiefReview upserts the chief's vote, keyed on application + reviewer.
// decided_at is stamped whenever a vote is provided.
func (s *Store) UpsertChiefReview(ctx context.Context, in ChiefReviewUpsert) (models.ChiefReviewDetail, error) {
	var detail models.ChiefReviewDetail
	const q = `
		INSERT INTO chief_reviews (application_id, reviewer_nuid, vote, decided_at)
		VALUES ($1, $2, $3, CASE WHEN $3::text IS NOT NULL THEN NOW() ELSE NULL END)
		ON CONFLICT (application_id, reviewer_nuid) DO UPDATE SET
			vote       = EXCLUDED.vote,
			decided_at = CASE WHEN $3::text IS NOT NULL THEN NOW() ELSE chief_reviews.decided_at END,
			updated_at = NOW()
		RETURNING ` + chiefReviewColumns
	rows, err := s.db.Query(ctx, q, in.ApplicationID, in.ReviewerNUID, in.Vote)
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

// ListChiefReviewsForApplications fetches chief reviews for many applications
// in one round trip, for callers rendering a page of applications at once —
// the per-application ListChiefReviews above turns into a request per row there.
func (s *Store) ListChiefReviewsForApplications(ctx context.Context, applicationIDs []string) ([]models.ChiefReviewDetail, error) {
	if len(applicationIDs) == 0 {
		return nil, nil
	}
	const q = `SELECT ` + chiefReviewColumns + ` FROM chief_reviews WHERE application_id = ANY($1::uuid[]) ORDER BY application_id, created_at`
	rows, err := s.db.Query(ctx, q, applicationIDs)
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
