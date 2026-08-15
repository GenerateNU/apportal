package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

// InterviewUpsert carries the interviewer's write-up. Nil scalar fields are
// preserved (partial update); Submit stamps submitted_at.
type InterviewUpsert struct {
	ApplicationID   string
	InterviewerNUID string
	ScheduledAt     *time.Time
	ConductedAt     *time.Time
	RecordingURL    *string
	NotesURL        *string
	Comments        *string
	Rating          *models.InterviewRating
	Submit          bool
}

const interviewColumns = `id, application_id, interviewer_nuid, scheduled_at, conducted_at, recording_url, notes_url, comments, rating, submitted_at, created_at, updated_at`

// UpsertInterview creates or updates the single interview record for an
// application (one per application). Provided fields overwrite; omitted ones
// are preserved.
func (s *Store) UpsertInterview(ctx context.Context, in InterviewUpsert) (models.Interview, error) {
	const q = `
		INSERT INTO interviews (application_id, interviewer_nuid, scheduled_at, conducted_at, recording_url, notes_url, comments, rating, submitted_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CASE WHEN $9 THEN NOW() ELSE NULL END)
		ON CONFLICT (application_id) DO UPDATE SET
			interviewer_nuid = EXCLUDED.interviewer_nuid,
			scheduled_at     = COALESCE(EXCLUDED.scheduled_at, interviews.scheduled_at),
			conducted_at     = COALESCE(EXCLUDED.conducted_at, interviews.conducted_at),
			recording_url    = COALESCE(EXCLUDED.recording_url, interviews.recording_url),
			notes_url        = COALESCE(EXCLUDED.notes_url, interviews.notes_url),
			comments         = COALESCE(EXCLUDED.comments, interviews.comments),
			rating           = COALESCE(EXCLUDED.rating, interviews.rating),
			submitted_at     = CASE WHEN $9 THEN NOW() ELSE interviews.submitted_at END,
			updated_at       = NOW()
		RETURNING ` + interviewColumns
	rows, err := s.db.Query(ctx, q, in.ApplicationID, in.InterviewerNUID, in.ScheduledAt,
		in.ConductedAt, in.RecordingURL, in.NotesURL, in.Comments, in.Rating, in.Submit)
	if err != nil {
		return models.Interview{}, err
	}
	return pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.Interview])
}

func (s *Store) GetInterview(ctx context.Context, applicationID string) (models.Interview, error) {
	const q = `SELECT ` + interviewColumns + ` FROM interviews WHERE application_id = $1`
	rows, err := s.db.Query(ctx, q, applicationID)
	if err != nil {
		return models.Interview{}, err
	}
	i, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.Interview])
	if errors.Is(err, pgx.ErrNoRows) {
		return i, ErrNotFound
	}
	return i, err
}

// ListInterviewsForApplications fetches the interviews for many applications in
// one round trip, for callers rendering a page of applications at once — the
// per-application GetInterview above turns into a request per row there.
func (s *Store) ListInterviewsForApplications(ctx context.Context, applicationIDs []string) ([]models.Interview, error) {
	if len(applicationIDs) == 0 {
		return nil, nil
	}
	const q = `SELECT ` + interviewColumns + ` FROM interviews WHERE application_id = ANY($1::uuid[]) ORDER BY application_id`
	rows, err := s.db.Query(ctx, q, applicationIDs)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[models.Interview])
}

// GetInterviewByID fetches an interview by its own ID (used by recording reviews).
func (s *Store) GetInterviewByID(ctx context.Context, id string) (models.Interview, error) {
	const q = `SELECT ` + interviewColumns + ` FROM interviews WHERE id = $1`
	rows, err := s.db.Query(ctx, q, id)
	if err != nil {
		return models.Interview{}, err
	}
	i, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.Interview])
	if errors.Is(err, pgx.ErrNoRows) {
		return i, ErrNotFound
	}
	return i, err
}
