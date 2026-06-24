package store

import (
	"context"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

// RecordingReviewUpsert carries an assigned TL's review of an interview recording.
type RecordingReviewUpsert struct {
	InterviewID  string
	ReviewerNUID string
	Comments     *string
	Rating       *models.InterviewRating
	Submit       bool
}

const recordingReviewColumns = `id, interview_id, reviewer_nuid, comments, rating, submitted_at, created_at, updated_at`

// UpsertRecordingReview upserts a reviewer's recording review, keyed on
// interview + reviewer.
func (s *Store) UpsertRecordingReview(ctx context.Context, in RecordingReviewUpsert) (models.InterviewRecordingReview, error) {
	const q = `
		INSERT INTO interview_recording_reviews (interview_id, reviewer_nuid, comments, rating, submitted_at)
		VALUES ($1, $2, $3, $4, CASE WHEN $5 THEN NOW() ELSE NULL END)
		ON CONFLICT (interview_id, reviewer_nuid) DO UPDATE SET
			comments     = EXCLUDED.comments,
			rating       = EXCLUDED.rating,
			submitted_at = CASE WHEN $5 THEN NOW() ELSE interview_recording_reviews.submitted_at END,
			updated_at   = NOW()
		RETURNING ` + recordingReviewColumns
	rows, err := s.db.Query(ctx, q, in.InterviewID, in.ReviewerNUID, in.Comments, in.Rating, in.Submit)
	if err != nil {
		return models.InterviewRecordingReview{}, err
	}
	return pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.InterviewRecordingReview])
}

func (s *Store) ListRecordingReviews(ctx context.Context, interviewID string) ([]models.InterviewRecordingReview, error) {
	const q = `SELECT ` + recordingReviewColumns + ` FROM interview_recording_reviews WHERE interview_id = $1 ORDER BY created_at`
	rows, err := s.db.Query(ctx, q, interviewID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[models.InterviewRecordingReview])
}
