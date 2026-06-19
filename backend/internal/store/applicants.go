package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type ApplicantUpsert struct {
	NUID           string
	Email          string
	FullName       string
	GithubUsername *string
	GraduationYear *int
	Major          *string
}

const applicantColumns = `nuid, email, full_name, github_username, graduation_year, major, created_at, updated_at`

// UpsertApplicant inserts a new applicant or updates the existing one keyed by
// NUID. A clash on the unique email (belonging to a different NUID) is a conflict.
func (s *Store) UpsertApplicant(ctx context.Context, in ApplicantUpsert) (models.Applicant, error) {
	const q = `
		INSERT INTO applicants (nuid, email, full_name, github_username, graduation_year, major)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (nuid) DO UPDATE SET
			email           = EXCLUDED.email,
			full_name       = EXCLUDED.full_name,
			github_username = EXCLUDED.github_username,
			graduation_year = EXCLUDED.graduation_year,
			major           = EXCLUDED.major
		RETURNING ` + applicantColumns
	rows, err := s.db.Query(ctx, q, in.NUID, in.Email, in.FullName,
		in.GithubUsername, in.GraduationYear, in.Major)
	if err != nil {
		return models.Applicant{}, err
	}
	a, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.Applicant])
	if uniqueViolation(err) {
		return a, ErrConflict
	}
	return a, err
}

func (s *Store) GetApplicant(ctx context.Context, nuid string) (models.Applicant, error) {
	const q = `SELECT ` + applicantColumns + ` FROM applicants WHERE nuid = $1`
	rows, err := s.db.Query(ctx, q, nuid)
	if err != nil {
		return models.Applicant{}, err
	}
	a, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.Applicant])
	if errors.Is(err, pgx.ErrNoRows) {
		return a, ErrNotFound
	}
	return a, err
}
