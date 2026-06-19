package store

import (
	"context"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

const codeSubmissionColumns = `id, application_id, challenge_id, github_repo_url, submitted_at, raw_score, score_details, score_updated_at`

// UpsertCodeSubmission records (or replaces) the GitHub repo link for an
// application's challenge. Score fields are deferred and left untouched here —
// they are populated externally.
func (s *Store) UpsertCodeSubmission(ctx context.Context, applicationID, challengeID, githubRepoURL string) (models.CodeSubmission, error) {
	const q = `
		INSERT INTO code_submissions (application_id, challenge_id, github_repo_url)
		VALUES ($1, $2, $3)
		ON CONFLICT (application_id, challenge_id) DO UPDATE SET
			github_repo_url = EXCLUDED.github_repo_url,
			submitted_at    = NOW()
		RETURNING ` + codeSubmissionColumns
	rows, err := s.db.Query(ctx, q, applicationID, challengeID, githubRepoURL)
	if err != nil {
		return models.CodeSubmission{}, err
	}
	c, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.CodeSubmission])
	if uniqueViolation(err) {
		return c, ErrConflict
	}
	return c, err
}

// ListCodeSubmissions returns every code submission for an application.
func (s *Store) ListCodeSubmissions(ctx context.Context, applicationID string) ([]models.CodeSubmission, error) {
	const q = `SELECT ` + codeSubmissionColumns + ` FROM code_submissions WHERE application_id = $1 ORDER BY submitted_at`
	rows, err := s.db.Query(ctx, q, applicationID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[models.CodeSubmission])
}
