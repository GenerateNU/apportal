package store

import (
	"context"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

// RecordingReviewUpsert carries an assigned lead's review of an interview recording.
type RecordingReviewUpsert struct {
	InterviewID  string
	ReviewerNUID string
	Comments     *string
	Rating       *models.InterviewRating
	Submit       bool
}

const recordingReviewColumns = `id, interview_id, reviewer_nuid, comments, rating, submitted_at, created_at, updated_at`

// UpsertRecordingReview upserts a reviewer's recording review, keyed on
// interview + reviewer. Provided fields overwrite; omitted ones are
// preserved (e.g. saving a comment-only edit must not null out a rating set
// on a previous call) — mirrors UpsertInterview's COALESCE contract.
func (s *Store) UpsertRecordingReview(ctx context.Context, in RecordingReviewUpsert) (models.InterviewRecordingReview, error) {
	const q = `
		INSERT INTO interview_recording_reviews (interview_id, reviewer_nuid, comments, rating, submitted_at)
		VALUES ($1, $2, $3, $4, CASE WHEN $5 THEN NOW() ELSE NULL END)
		ON CONFLICT (interview_id, reviewer_nuid) DO UPDATE SET
			comments     = COALESCE(EXCLUDED.comments, interview_recording_reviews.comments),
			rating       = COALESCE(EXCLUDED.rating, interview_recording_reviews.rating),
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

// ListRecordingReviewsForInterviews fetches recording reviews for many
// interviews in one round trip, for callers rendering a page of applications
// at once — the per-interview ListRecordingReviews above turns into a
// request per row there.
func (s *Store) ListRecordingReviewsForInterviews(ctx context.Context, interviewIDs []string) ([]models.InterviewRecordingReview, error) {
	if len(interviewIDs) == 0 {
		return nil, nil
	}
	const q = `SELECT ` + recordingReviewColumns + ` FROM interview_recording_reviews WHERE interview_id = ANY($1::uuid[]) ORDER BY interview_id, created_at`
	rows, err := s.db.Query(ctx, q, interviewIDs)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[models.InterviewRecordingReview])
}
