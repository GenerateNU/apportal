package store

import (
	"context"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

// ChiefReviewUpsert carries a chief's review of an application.
type ChiefReviewUpsert struct {
	ApplicationID      string
	ReviewerNUID       string
	Notes              *string
	AdvanceToInterview *bool // non-nil marks the decision (stamps decided_at)
}

const chiefReviewColumns = `id, application_id, reviewer_nuid, notes, advance_to_interview, decided_at, created_at, updated_at`

// UpsertChiefReview upserts the chief's review, keyed on application + reviewer.
// decided_at is stamped whenever advance_to_interview is provided.
func (s *Store) UpsertChiefReview(ctx context.Context, in ChiefReviewUpsert) (models.ChiefReview, error) {
	const q = `
		INSERT INTO chief_reviews (application_id, reviewer_nuid, notes, advance_to_interview, decided_at)
		VALUES ($1, $2, $3, $4::boolean, CASE WHEN $4::boolean IS NOT NULL THEN NOW() ELSE NULL END)
		ON CONFLICT (application_id, reviewer_nuid) DO UPDATE SET
			notes                = EXCLUDED.notes,
			advance_to_interview = EXCLUDED.advance_to_interview,
			decided_at           = CASE WHEN $4::boolean IS NOT NULL THEN NOW() ELSE chief_reviews.decided_at END,
			updated_at           = NOW()
		RETURNING ` + chiefReviewColumns
	rows, err := s.db.Query(ctx, q, in.ApplicationID, in.ReviewerNUID, in.Notes, in.AdvanceToInterview)
	if err != nil {
		return models.ChiefReview{}, err
	}
	return pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.ChiefReview])
}

func (s *Store) ListChiefReviews(ctx context.Context, applicationID string) ([]models.ChiefReview, error) {
	const q = `SELECT ` + chiefReviewColumns + ` FROM chief_reviews WHERE application_id = $1 ORDER BY created_at`
	rows, err := s.db.Query(ctx, q, applicationID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[models.ChiefReview])
}
